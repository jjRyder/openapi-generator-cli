import { Test } from '@nestjs/testing';
import { Version, VersionManagerService } from './version-manager.service';
import { HttpService } from '@nestjs/axios';
import { of } from 'rxjs';
import { LOGGER } from '../constants';
import chalk from 'chalk';
import { ConfigService } from './config.service';
import { resolve } from 'path';
import * as os from 'os';
import { TestingModule } from '@nestjs/testing/testing-module';
import * as path from 'path';

jest.mock('fs-extra');

// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = jest.mocked(require('fs-extra'));

describe('VersionManagerService', () => {
  let fixture: VersionManagerService;

  const get = jest.fn();
  const log = jest.fn();

  const getVersion = jest.fn().mockReturnValue('4.3.0');
  const getStorageDir = jest.fn().mockReturnValue(undefined);
  const setVersion = jest.fn();

  let testBed: TestingModule;

  const compile = async () => {
    testBed = await Test.createTestingModule({
      providers: [
        VersionManagerService,
        { provide: HttpService, useValue: { get } },
        {
          provide: ConfigService,
          useValue: {
            get: (k) => {
              if (k === 'generator-cli.storageDir') {
                return getStorageDir(k);
              }

              if (k === 'generator-cli.repository.queryUrl') {
                return undefined;
                // return 'https://search.maven.custom/solrsearch/select?q=g:${repository.groupId}+AND+a:${repository.artifactId}&core=gav&start=0&rows=250';
              }

              if (k === 'generator-cli.repository.downloadUrl') {
                return undefined;
                // return 'https://search.maven.custom/solrsearch/select?q=g:${repository.groupId}+AND+a:${repository.artifactId}&core=gav&start=0&rows=250';
              }

              return getVersion(k);
            },
            set: setVersion,
            cwd: '/c/w/d',
          },
        },
        { provide: LOGGER, useValue: { log } },
      ],
    }).compile();

    fixture = testBed.get(VersionManagerService);
  };

  beforeEach(async () => {
    [get].forEach((fn) => fn.mockClear());
    getStorageDir.mockReturnValue(undefined);
    await compile();
    fs.existsSync
      .mockReset()
      .mockImplementation((filePath) => filePath.indexOf('4.2') !== -1);
  });

  const getHardcodedVersions = () => fixture.versions;

  describe('API', () => {
    describe('getAll()', () => {
      let returnValue: Version[];

      beforeEach(async () => {
        returnValue = await fixture.getAll().toPromise();
      });

      it('does not make any HTTP requests', () => {
        expect(get).not.toHaveBeenCalled();
      });

      it('returns the hardcoded versions list', () => {
        expect(returnValue).toEqual(getHardcodedVersions());
        expect(returnValue.length).toBeGreaterThan(0);
      });

      it('has 1.0.0 as the first version with the latest tag', () => {
        expect(returnValue[0].version).toEqual('1.0.0');
        expect(returnValue[0].versionTags).toContain('latest');
      });
    });

    describe('search()', () => {
      let returnValue: Version[];

      describe('using empty tags array', () => {
        beforeEach(async () => {
          returnValue = await fixture.search([]).toPromise();
        });

        it('does not make any HTTP requests', () => {
          expect(get).not.toHaveBeenCalled();
        });

        it('returns all versions', () => {
          expect(returnValue).toEqual(getHardcodedVersions());
        });
      });

      describe('using tags [ "beta" ]', () => {
        beforeEach(async () => {
          returnValue = await fixture.search(['beta']).toPromise();
        });

        it('returns only beta versions', () => {
          expect(returnValue.length).toBeGreaterThan(0);
          expect(returnValue.every(v => v.versionTags.some(t => t.indexOf('beta') === 0))).toBe(true);
        });
      });

      describe('using tags [ "latest" ]', () => {
        beforeEach(async () => {
          returnValue = await fixture.search(['latest']).toPromise();
        });

        it('returns only the latest version', () => {
          expect(returnValue.length).toBe(1);
          expect(returnValue[0].version).toEqual('1.0.0');
        });
      });

      describe('using tags [ "stable" ]', () => {
        beforeEach(async () => {
          returnValue = await fixture.search(['stable']).toPromise();
        });

        it('returns only stable versions', () => {
          expect(returnValue.length).toBeGreaterThan(0);
          expect(returnValue.every(v => v.versionTags.includes('stable'))).toBe(true);
        });
      });

      describe('using tags [ "7.20" ]', () => {
        beforeEach(async () => {
          returnValue = await fixture.search(['7.20']).toPromise();
        });

        it('returns the correct versions', () => {
          expect(returnValue.length).toBe(1);
          expect(returnValue[0].version).toEqual('7.20.0');
        });
      });
    });

    describe('isSelectedVersion()', () => {
      it('return true if equal to the selected version', () => {
        expect(fixture.isSelectedVersion('4.3.0')).toBeTruthy();
      });

      it('return false if equal to the selected version', () => {
        expect(fixture.isSelectedVersion('4.3.1')).toBeFalsy();
      });
    });

    describe('getSelectedVersion', () => {
      it('returns the value from the config service', () => {
        expect(fixture.getSelectedVersion()).toEqual('4.3.0');
        expect(getVersion).toHaveBeenNthCalledWith(1, 'generator-cli.version');
      });
    });

    describe('setSelectedVersion', () => {
      beforeEach(() => {
        log.mockReset();
        setVersion.mockReset();
      });

      describe('when version is available (downloaded)', () => {
        beforeEach(async () => {
          jest.spyOn(fixture, 'isDownloaded').mockReturnValue(true);
          await fixture.setSelectedVersion('1.2.3');
        });

        it('sets the correct config value', () => {
          expect(setVersion).toHaveBeenNthCalledWith(
            1,
            'generator-cli.version',
            '1.2.3',
          );
        });

        it('logs a success message', () => {
          expect(log).toHaveBeenNthCalledWith(
            1,
            chalk.green('Did set selected version to 1.2.3'),
          );
        });
      });

      describe('when version is not available', () => {
        it('throws an error', async () => {
          jest.spyOn(fixture, 'isDownloaded').mockReturnValue(false);
          await expect(fixture.setSelectedVersion('1.2.3')).rejects.toThrow(
            'Version 1.2.3 is not available. Available versions must be bundled in the package.',
          );
        });
      });
    });

    describe('remove()', () => {
      let logMessages = {
        before: [],
        after: [],
      };

      beforeEach(() => {
        logMessages = {
          before: [],
          after: [],
        };

        log.mockReset().mockImplementation((m) => logMessages.before.push(m));

        fs.removeSync.mockImplementation(() => {
          log.mockReset().mockImplementation((m) => logMessages.after.push(m));
        });

        fixture.remove('4.3.1');
      });

      it('removes the correct file', () => {
        expect(fs.removeSync).toHaveBeenNthCalledWith(
          1,
          `${fixture.storage}/4.3.1.jar`,
        );
      });

      it('logs the correct messages', () => {
        expect(logMessages).toEqual({
          before: [],
          after: [chalk.green(`Removed 4.3.1`)],
        });
      });
    });

    describe('isDownloaded()', () => {
      it('returns true, if the file exists', () => {
        fs.existsSync.mockReturnValue(true);
        expect(fixture.isDownloaded('4.3.1')).toBeTruthy();
      });

      it('returns false, if the file does not exists', () => {
        fs.existsSync.mockReturnValue(false);
        expect(fixture.isDownloaded('4.3.1')).toBeFalsy();
      });

      it('provides the correct file path', () => {
        fixture.isDownloaded('4.3.1');
        expect(fs.existsSync).toHaveBeenNthCalledWith(
          1,
          fixture.storage + '/4.3.1.jar',
        );
      });
    });

    describe('filePath()', () => {
      it('returns the path to the given version name', () => {
        expect(fixture.filePath('1.2.3')).toEqual(
          `${fixture.storage}/1.2.3.jar`,
        );
      });

      it('returns the path to the selected version name as default', () => {
        expect(fixture.filePath()).toEqual(`${fixture.storage}/4.3.0.jar`);
      });
    });

    describe('storage', () => {
      describe('there is no custom storage location', () => {
        it('returns the correct location path', () => {
          expect(fixture.storage).toEqual(resolve(__dirname, './versions'));
        });
      });

      describe('there is a custom storage location', () => {
        it.each([
          ['/c/w/d/custom/dir', './custom/dir'],
          ['/custom/dir', '/custom/dir'],
          ['/custom/dir', '/custom/dir/'],
          [`${os.homedir()}/oa`, '~/oa/'],
          [`${os.homedir()}/oa`, '~/oa'],
        ])('returns %s for %s', async (expected, cfgValue) => {
          getStorageDir.mockReturnValue(cfgValue);
          await compile();
          expect(fixture.storage).toEqual(expected);
        });
      });
    });
  });
});
