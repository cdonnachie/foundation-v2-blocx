const Logger = require('../main/logger');
const Workers = require('../main/workers');
const config = require('../../configs/example');
const configMain = require('../../configs/main.js');
const nock = require('nock');
const testdata = require('../../daemon/test/daemon.mock');

config.primary.address = 'B6k2XqSPYkjuT7kNgkZZTj3tJidjEzDjEe';
config.primary.recipients[0].address = 'BSQgk7ukF5Vxc16EHK1VT2JkECJYmUeC1w';
config.primary.daemons = [{
  'host': '127.0.0.1',
  'port': '12971',
  'username': 'foundation',
  'password': 'foundation'
}];

process.env.config = JSON.stringify(config);
process.env.configMain = JSON.stringify(configMain);

nock.disableNetConnect();
nock.enableNetConnect('127.0.0.1');

////////////////////////////////////////////////////////////////////////////////

describe('Test workers functionality', () => {

  let configMainCopy, rpcDataCopy;
  beforeEach(() => {
    configMainCopy = JSON.parse(JSON.stringify(configMain));
    rpcDataCopy = JSON.parse(JSON.stringify(testdata.getBlockTemplate()));
  });

  beforeEach(() => nock.cleanAll());
  afterAll(() => nock.restore());
  beforeAll(() => {
    if (!nock.isActive()) nock.activate();
    nock.enableNetConnect();
  });

  test('Test initialization of workers', () => {
    const logger = new Logger(configMainCopy);
    const workers = new Workers(logger);
    expect(typeof workers.configMain).toBe('object');
    expect(typeof workers.handlePromises).toBe('function');
    expect(typeof workers.setupWorkers).toBe('function');
  });

  test('Test worker stratum creation', (done) => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const logger = new Logger(configMainCopy);
    const workers = new Workers(logger);
    nock('http://127.0.0.1:12971')
      .post('/', (body) => body.method === 'getpeerinfo')
      .reply(200, JSON.stringify({
        id: 'nocktest',
        error: null,
        result: null,
      }));
    nock('http://127.0.0.1:12976')
      .post('/', (body) => body.method === 'getpeerinfo')
      .reply(200, JSON.stringify({
        id: 'nocktest',
        error: null,
        result: null,
      }));
    nock('http://127.0.0.1:12971')
      .post('/').reply(200, JSON.stringify([
        { id: 'nocktest', error: null, result: { isvalid: true, address: 'B6k2XqSPYkjuT7kNgkZZTj3tJidjEzDjEe' }},
        { id: 'nocktest', error: null, result: { networkhashps: 0 }},
        { id: 'nocktest', error: null, result: { chain: 'main', difficulty: 0 }},
        { id: 'nocktest', error: null, result: { protocolversion: 1, connections: 1 }},
      ]));
    nock('http://127.0.0.1:12971')
      .persist()
      .post('/', (body) => body.method === 'getblocktemplate')
      .reply(200, JSON.stringify({
        id: 'nocktest',
        error: null,
        result: rpcDataCopy,
      }));
    workers.setupWorkers(() => {
      const stratum = workers.stratum;
      stratum.stratum.network.on('network.stopped', () => done());
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringMatching('is lower than the difficulty on port'));
      stratum.stratum.network.stopNetwork();
      console.log.mockClear();
      done();
    });
  });
});
