import DynamoDbLocal from 'dynamodb-local';
import {DynamoDB} from '@aws-sdk/client-dynamodb';
import type {ListTablesCommandOutput} from '@aws-sdk/client-dynamodb/dist-types/commands/ListTablesCommand';
import type {argValues} from 'dynamodb-local';
import type {CreateTableCommandInput} from '@aws-sdk/client-dynamodb';
import getConfig from './utils/get-config';
import deleteTables from './utils/delete-tables';
import waitForLocalhost from './utils/wait-for-localhost';
import getRelevantTables from './utils/get-relevant-tables';

const debug = require('debug')('jest-dynamodb');

const DEFAULT_PORT = 8000;
const DEFAULT_HOST = 'localhost';
const DEFAULT_OPTIONS: argValues[] = ['-sharedDb'];

const sleep = (time: number) => new Promise(res => setTimeout(res, time))

export default async function () {
  const {
    tables: newTables,
    clientConfig,
    installerConfig,
    port: port = DEFAULT_PORT,
    hostname: hostname = DEFAULT_HOST,
    options: options = DEFAULT_OPTIONS,
  } = await getConfig(debug);

  const dynamoDB = new DynamoDB({
    endpoint: `http://${hostname}:${port}`,
    tls: false,
    region: 'local-env',
    credentials: {
      accessKeyId: 'fakeMyKeyId',
      secretAccessKey: 'fakeSecretAccessKey',
    },
    ...clientConfig,
  });

  global.__DYNAMODB_CLIENT__ = dynamoDB;

  try {
    const promises: (Promise<ListTablesCommandOutput> | Promise<void>)[] = [
      dynamoDB.listTables({}),
    ];

    if (!global.__DYNAMODB__) {
      promises.push(waitForLocalhost(port, hostname));
    }

    const [TablesList] = await Promise.all(promises);
    const tableNames = TablesList?.TableNames;

    if (tableNames) {
      await deleteTables(dynamoDB, getRelevantTables(tableNames, newTables));
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    debug(`fallback to launch DB due to ${err}`);

    if (installerConfig) {
      DynamoDbLocal.configureInstaller(installerConfig);
    }

    if (!global.__DYNAMODB__) {
      debug('spinning up a local ddb instance');

      global.__DYNAMODB__ = await DynamoDbLocal.launch(port, null, options);
      debug(`dynamodb-local started on port ${port}`);

      await waitForLocalhost(port, hostname);
    }
  }
  debug(`dynamodb-local is ready on port ${port}`);

  await createTables(dynamoDB, newTables);
  await sleep(2000);
}

function createTables(dynamoDB: DynamoDB, tables: CreateTableCommandInput[]) {
  return Promise.all(tables.map(table => dynamoDB.createTable(table)));
}
