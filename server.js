const _ = require('lodash');
const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');

const { OAuthHandler } = require('./oauth');

const port = process.env.PORT || 8080;
const baseUrl = process.env.COZY_BASE_URL || 'https://sebprunier.mycozy.cloud';
const oauthHandler = new OAuthHandler(baseUrl, `io.cozy.bills:GET io.cozy.files:GET`);

const app = express();
app.use(bodyParser.json());

function downloadFile(doc, req, res) {
  return oauthHandler.withOAuthToken(req, res, (accessToken, callFailed, callPassed) => {
    fetch(`${baseUrl}/files/download/${doc._id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      }
    })
    .then(r => {
      if (r.status == 200) {
        callPassed();
        return r.buffer().then(b => res.type(doc.mime).send(b));
      } if (r.status === 401 || r.status === 403) {
        callFailed();
        return r.text().then(text => {
          console.log('failed because', text)
        });
      } else {
        callPassed();
        return res.type('json').send({
          status: r.status,
          error: 'error'
        });
      }
    }).catch(e => {
      console.log('error while downloadFile', e)
    });
  });
}

function fetchAllFiles(req, res) {
  return oauthHandler.withOAuthToken(req, res, (accessToken, callFailed, callPassed) => {
    fetch(`${baseUrl}/data/io.cozy.bills/_all_docs?include_docs=true`, {
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
          const invoiceLink = (doc) => {
            if (!doc.invoice) {
              return '-';
            } else {
              const invoice = doc.invoice;
              const invoiceFileId = invoice.split(':')[1];
              // TODO get mime type from metadata
              return `<a href="/files/${invoiceFileId}?mime=application/pdf">${doc.filename}</a>`;
            }
          }
          const html = `<html>
              <head>
                <title>Vos dernière factures</title>
                <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.1.3/css/bootstrap.min.css" integrity="sha384-MCw98/SFnGE8fJT3GXwEOngsV7Zt27NXFoaoApmYm81iuXoPkFOJwJ8ERdknLPMO" crossorigin="anonymous">
              </head>
              <body>
                <h1>Vos dernières factures</h1>
                <table class="table table-hover">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Origine</th>
                      <th>Montant</th>
                      <th>Devise</th>
                      <th>Facture</th>
                    </tr>
                  </thead>
                  <tbody>
                  ${
                    json.rows
                      .map(r => r.doc)
                      .filter(doc => doc.date && doc.vendor)
                      .map(doc => {
                        return {...doc, localeDate: doc.date.split('T')[0]}
                      })
                      .sort((d1, d2) => d1.localeDate > d2.localeDate ? -1 : 1)
                      .map(doc => `<tr>
                        <td>${doc.localeDate}</td>
                        <td>${doc.vendor}</td>
                        <td>${doc.amount}</td>
                        <td>${doc.currency}</td>
                        <td>${invoiceLink(doc)}</td>
                      </tr>`).join('\n')
                  }
                  </tbody>
                </table>
              </body>
            </html>`;
          res.type('html').send(html);
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
      console.log('error while fetchAllFiles', e)
    });
  });
}

app.get('/', (req, res) => {
  fetchAllFiles(req, res);
  // fetchKonnectors(req, res);
});

app.get('/files/:id', (req, res) => {
  const _id = req.params.id;
  const mime = req.query.mime;
  downloadFile({ _id, mime }, req, res);
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
