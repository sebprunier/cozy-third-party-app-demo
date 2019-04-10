const _ = require('lodash');
const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');

const app = express();
const port = process.env.PORT || 8080;

let token = null;


function handleNoToken(req, res) {

}

app.use(bodyParser.json());

app.get('/', (req, res) => {
  if (!token) {
    handleNoToken(req, res);
  } else {
    res.type('html').send("<h1>Hello</h>")
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