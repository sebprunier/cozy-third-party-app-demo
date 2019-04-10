const _ = require('lodash');
const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');

const app = express();
const port = process.env.PORT || 8080;

const baseUrl = 'https://sebprunier.mycozy.cloud'
const redirectUri = 'http://127.0.0.1:8080/oauth/callback';
const scope = 'io.cozy.apps:GET';
const state = '123456';
const clientId = "";
const clientSecret = "";

let token = null;
let refreshToken = null;

function handleNoToken(req, res) {
  res.status(302).set('Location', `${baseUrl}/auth/login?state=${state}&scope=${scope}&client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}`).send('');
}

app.use(bodyParser.json());

app.get('/', (req, res) => {
  if (!token) {
    handleNoToken(req, res);
  } else {
    fetch(`${baseUrl}/konnectors/`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer: ${token}`,
        'Accept': 'application/vnd.api+json'
      }
    })
    .then(r => r.json())
    .then(json => {
      res.type('html').send(json.stringify())
    })
  }
});

app.get('/oauth/token', (req, res) => {
  const code = req.query.code;
  fetch(`${baseUrl}/auth/authorize`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: `state=${state}&code=${code}&grant_type=authorization_code&client_id=${clientId}&client_secret=${clientSecret}&redirect_uri=${redirectUri}&csrf_token=123456`
  }).then(r => r.json()).then(resp => {
    token = resp.access_token;
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

app.listen(port, () => {
  console.log(`cozy-demo listening on port ${port}!`);
});