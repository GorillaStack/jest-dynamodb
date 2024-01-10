import {resolve} from 'path';
import cwd from 'cwd';
import type {Config} from '../types';

export default async function getConfig(debug: any): Promise<Config> {
  const path = process.env.JEST_DYNAMODB_CONFIG || resolve(cwd(), 'jest-dynamodb-config.js');
  const config = require(path);
  debug('TESTING', path);
  debug('DEBUGGING THE CONFIG', config());

  return typeof config === 'function' ? await config() : config;
}
