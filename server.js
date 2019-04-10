const fs = require('fs');
const _ = require('lodash');
const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');

const app = express();
const port = process.env.PORT || 8080;

const baseUrl = process.env.COZY_BASE_URL || 'https://sebprunier.mycozy.cloud';
const redirectUri = 'http://127.0.0.1:8080/oauth/callback';
const scope = 'io.cozy.triggers:GET io.cozy.jobs:GET';
const state = '123456';

let accessToken = null;
let refreshToken = null;
let clientConfig = null;

function token() {
  if (accessToken) {
    const pl = JSON.parse(accessToken.split('.')[1]);
    console.log('accessToken', pl);
    return Promise.resolve(accessToken); // TODO: remove
    if (pl.exp < Date.now()) {
      return refreshAccessToken().then(() => accessToken);
    } else {
      return Promise.resolve(accessToken);
    }
  } else {
    return Promise.resolve(null);
  }
}

function handleNoToken(req, res) {
  res.status(302).set('Location', `${baseUrl}/auth/authorize?state=${state}&scope=${scope}&client_id=${clientConfig.clientId}&response_type=code&redirect_uri=${redirectUri}&csrf_token=${state}`).send('');
}

function registerOrLoadClient() {
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
  return fetch(`${baseUrl}/auth/access_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: `state=${state}&refresh_token=${refreshToken}&grant_type=refresh_token&client_id=${clientConfig.clientId}&client_secret=${clientConfig.clientSecret}&redirect_uri=${redirectUri}&csrf_token=${state}`
  }).then(r => r.json()).then(resp => {
    console.log('refreshAccessToken', resp)
    accessToken = resp.access_token;
    refreshToken= resp.refresh_token;
  });
}

app.use(bodyParser.json());

app.get('/', (req, res) => {
  return token().then(tok => {
    if (!tok) {
      handleNoToken(req, res);
    } else {
      fetch(`${baseUrl}/api/jobs/`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer: ${tok}`,
          'Accept': 'application/vnd.api+json'
        }
      })
      .then(r => r.json())
      .then(json => {
        console.log(json)
        const html = JSON.stringify(json)
        res.type('html').send(html)
      })
    }
  });
});

app.get('/oauth/callback', (req, res) => {
  console.log(req.query)
  console.log(req.headers)
  const code = req.query.code;
  fetch(`${baseUrl}/auth/access_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: `state=${state}&code=${code}&grant_type=authorization_code&client_id=${clientConfig.clientId}&client_secret=${clientConfig.clientSecret}&redirect_uri=${redirectUri}`
  }).then(r => r.json()).then(resp => {
    console.log(resp)
    accessToken = resp.access_token;
    refreshToken= resp.refresh_token;
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
