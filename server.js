const _ = require('lodash');
const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');

const app = express();
const port = process.env.PORT || 8080;

const baseUrl = 'https://sebprunier.mycozy.cloud'

let token = null;


function handleNoToken(req, res) {

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