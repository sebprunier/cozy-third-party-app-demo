const fetch = require('node-fetch');
const fs = require('fs');

const redirectUri = 'http://127.0.0.1:8080/oauth/callback';
const state = '123456';

class OAuthHandler {

  constructor(baseUrl, scope) {
    this.baseUrl = baseUrl;
    this.scope = scope;
    this.accessToken = null;
    this.refreshToken = null;
    this.clientConfig = null;
    this.refresh = false;
  }

  writeTokens() {
    const allTokens = JSON.parse(fs.readFileSync('./tokens.json').toString('utf8'));
    allTokens[this.scope] = {
      accessToken: this.accessToken,
      refreshToken: this.refreshToken
    };
    fs.writeFileSync('./tokens.json', JSON.stringify(allTokens, null, 2))
  }

  registerOrLoadClient() {
    try {
      const allTokens = JSON.parse(fs.readFileSync('./tokens.json').toString('utf8'));
      const tokens = allTokens[this.scope] || {};
      this.accessToken = tokens.accessToken;
      this.refreshToken = tokens.refreshToken;
    } catch(e) {
      console.log('No tokens file found.')
    }
    try {
      this.clientConfig = JSON.parse(fs.readFileSync('./client.json').toString('utf8'));
      console.log('Loaded client config !');
      return Promise.resolve(clientConfig);
    } catch(e) {
      console.log('Registering client ...');
      return fetch(`${this.baseUrl}/auth/register`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          "redirect_uris": [ redirectUri ],
          "client_name": "cozy-third-party-app-demo",
          "software_id": "github.com/sebprunier/cozy-third-party-app-demo"
        })
      }).then(r => r.json()).then(conf => {
        this.clientConfig = conf;
        fs.writeFileSync('./client.json', JSON.stringify(conf, null, 2));
      });
    }
  }
  
  refreshAccessToken() {
    console.log('refreshAccessToken');
    return fetch(`${this.baseUrl}/auth/access_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: `state=${state}&refresh_token=${this.refreshToken}&grant_type=refresh_token&client_id=${this.clientConfig.client_id}&client_secret=${this.clientConfig.client_secret}&redirect_uri=${redirectUri}&csrf_token=${state}`
    }).then(r => r.json()).then(resp => {
      console.log('refreshAccessToken resp', resp)
      this.accessToken = resp.access_token;
      this.writeTokens();
    }).catch(e => {
      console.log('error while refreshAccessToken', e)
    });
  }
  
  fetchAccessToken(code) {
    console.log('fetchAccessToken');
    return fetch(`${this.baseUrl}/auth/access_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: `state=${state}&code=${code}&grant_type=authorization_code&client_id=${this.clientConfig.client_id}&client_secret=${this.clientConfig.client_secret}&redirect_uri=${redirectUri}`
    }).then(r => r.json()).then(resp => {
      console.log('fetchAccessToken resp', resp)
      this.accessToken = resp.access_token;
      this.refreshToken = resp.refresh_token;
      this.writeTokens();
    }).catch(e => {
      console.log('error while fetchAccessToken', e)
    });
  }
  
  withOAuthToken(req, res, f) {
    if (this.accessToken) {
      const callPassed = () => {
        this.refresh = false;
      };
      const callFailed = () => {
        if (!refresh) {
          this.refresh = true;
          return this.refreshAccessToken().then(() => {
            f(this.accessToken, callFailed, callPassed);
          });
        } else {
          this.accessToken = null;
          this.refresh = false;
        }
      };
      f(this.accessToken, callFailed, callPassed);
    } else {
      this.refresh = false;
      return this.handleNoToken(req, res);
    }
  }

  handleNoToken(req, res) {
    res.status(302).set('Location', `${this.baseUrl}/auth/authorize?state=${state}&scope=${this.scope}&client_id=${this.clientConfig.client_id}&response_type=code&redirect_uri=${redirectUri}&csrf_token=${state}`).send('');
  }
}

exports.OAuthHandler = OAuthHandler;