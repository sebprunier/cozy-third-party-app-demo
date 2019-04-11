const _ = require('lodash');
const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');

const { OAuthHandler } = require('./oauth');

const port = process.env.PORT || 8080;
const resource = process.env.COZY_RESOURCE || 'konnectors';
const baseUrl = process.env.COZY_BASE_URL || 'https://sebprunier.mycozy.cloud';
const oauthHandler = new OAuthHandler(baseUrl, `io.cozy.konnectors io.cozy.events io.cozy.files`);

const app = express();
app.use(bodyParser.json());

function fetchAllFiles(req, res) {
  return oauthHandler.withOAuthToken(req, res, (accessToken, callFailed, callPassed) => {
    fetch(`${baseUrl}/data/io.cozy.files/_all_docs?include_docs=true`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    })
    .then(r => {
      if (r.status == 200) {
        callPassed();
        return r.json().then(json => {
          const html = JSON.stringify(json, null, 2)
          res.type('html').send(`<pre>${html}</pre>`)
        });
      } if (r.status === 401 || r.status === 403) {
        callFailed();
        return r.text().then(text => {
          console.log('failed because', text)
        });
      } else {
        callPassed();
        return r.text().then(text => {
          res.type('json').send({
            status: r.status,
            text: text
          })
        });
      }
    }).catch(e => {
      console.log('error while main func', e)
    });
  });
}

function fetchKonnectors(req, res) {
  return oauthHandler.withOAuthToken(req, res, (accessToken, callFailed, callPassed) => {
    fetch(`${baseUrl}/konnectors/`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    })
    .then(r => {
      if (r.status == 200) {
        callPassed();
        return r.json().then(json => {
          const html = JSON.stringify(json, null, 2)
          res.type('html').send(`<pre>${html}</pre>`)
        });
      } if (r.status === 401 || r.status === 403) {
        callFailed();
        return r.text().then(text => {
          console.log('failed because', text)
        });
      } else {
        callPassed();
        return r.text().then(text => {
          res.type('json').send({
            status: r.status,
            text: text
          })
        });
      }
    }).catch(e => {
      console.log('error while main func', e)
    });
  });
}

app.get('/', (req, res) => {
  fetchAllFiles(req, res);
  // fetchKonnectors(req, res);
});

app.get('/oauth/callback', (req, res) => {
  const code = req.query.code;
  oauthHandler.fetchAccessToken(code).then(() => {
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

oauthHandler.registerOrLoadClient().then(() => {
  app.listen(port, () => {
    console.log(`cozy-demo listening on port ${port}!`);
  });
});
