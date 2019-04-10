const fs = require('fs');
const _ = require('lodash');
const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');

const app = express();
const port = process.env.PORT || 8080;

const baseUrl = process.env.COZY_BASE_URL || 'https://sebprunier.mycozy.cloud';
const redirectUri = 'http://127.0.0.1:8080/oauth/callback';
const scope = 'io.cozy.konnectors';
const state = '123456';

////////////////////////////////////////////////////////////////////////////////////////

let accessToken = null;
let refreshToken = null;
let clientConfig = null;

function registerOrLoadClient() {
  try {
    const tokens = JSON.parse(fs.readFileSync('./tokens.json').toString('utf8'));
    accessToken = tokens.access_token;
    refreshToken = tokens.refresh_token;
  } catch(e) {
    console.log('No tokens file found.')
  }
  try {
    clientConfig = JSON.parse(fs.readFileSync('./client.json').toString('utf8'));
    console.log('Loaded client config !');
    return Promise.resolve(clientConfig);
  } catch(e) {
    console.log('Registering client ...');
    return fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        "redirect_uris": ["http://127.0.0.1:8080/oauth/callback"],
        "client_name": "cozy-third-party-app-demo",
        "software_id": "github.com/sebprunier/cozy-third-party-app-demo"
      })
    }).then(r => r.json()).then(conf => {
      clientConfig = conf;
      fs.writeFileSync('./client.json', JSON.stringify(conf, null, 2));
    });
  }
}

function refreshAccessToken() {
  console.log('refreshAccessToken');
  return fetch(`${baseUrl}/auth/access_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: `state=${state}&refresh_token=${refreshToken}&grant_type=refresh_token&client_id=${clientConfig.client_id}&client_secret=${clientConfig.client_secret}&redirect_uri=${redirectUri}&csrf_token=${state}`
  }).then(r => r.json()).then(resp => {
    console.log('refreshAccessToken resp', resp)
    accessToken = resp.access_token;
    fs.writeFileSync('./tokens.json', JSON.stringify({
      accessToken,
      refreshToken
    }, null, 2))
  });
}

function fetchAccessToken(code) {
  console.log('fetchAccessToken');
  return fetch(`${baseUrl}/auth/access_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: `state=${state}&code=${code}&grant_type=authorization_code&client_id=${clientConfig.client_id}&client_secret=${clientConfig.client_secret}&redirect_uri=${redirectUri}`
  }).then(r => r.json()).then(resp => {
    console.log('fetchAccessToken resp', resp)
    accessToken = resp.access_token;
    refreshToken = resp.refresh_token;
    fs.writeFileSync('./tokens.json', JSON.stringify({
      accessToken,
      refreshToken
    }, null, 2))
  });
}

function withOAuthToken(req, res, f) {
  if (accessToken) {
    const callFailed = () => {
      return refreshAccessToken().then(() => {
        f(callFailed);
      });
    };
    f(callFailed);
  } else {
    return handleNoToken(req, res);
  }
}

////////////////////////////////////////////////////////////////////////////////////////

app.use(bodyParser.json());

function handleNoToken(req, res) {
  res.status(302).set('Location', `${baseUrl}/auth/authorize?state=${state}&scope=${scope}&client_id=${clientConfig.client_id}&response_type=code&redirect_uri=${redirectUri}&csrf_token=${state}`).send('');
}

app.get('/', (req, res) => {
  console.log(`Bearer ${accessToken}`)
  withOAuthToken(req, res, callFailed => {
    fetch(`${baseUrl}/konnectors/`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.api+json'
      }
    })
    .then(r => {
      console.log('status', r.status);
      if (r.status == 200) {
        r.json().then(json => {
          console.log(json)
          const html = JSON.stringify(json)
          res.type('html').send(html)
        });
      } if (r.status === 401 || r.status === 403) {
        r.text().then(text => {
          console.log('failed because', text)
        });
        callFailed();
      } else {
        r.text().then(text => {
          res.type('json').send({
            status: r.status,
            text: text
          })
        });
      }
    })
  })
});

app.get('/oauth/callback', (req, res) => {
  const code = req.query.code;
  fetchAccessToken(code).then(() => {
    res.status(302).set('Location', `/`).send('');
  });
});

app.use((err, req, res, next) => {
  if (err) {
    console.log(err);
    res.status(500).send({ error: err.message })
  } else {
    try {
      next();
    } catch(e) {
      res.status(500).send({ error: e.message })
    }
  }
});

registerOrLoadClient().then(() => {
  app.listen(port, () => {
    console.log(`cozy-demo listening on port ${port}!`);
  });
});
