'use strict';
const MongoClient = require('mongodb').MongoClient;
const express = require("express");
const bodyParser = require('body-parser');
const async = require('async');
const ObjectId = require('mongodb').ObjectID;

const config = require("./config.js");


const initHttpServer = () => {
    const app = express();
    app.use(bodyParser.json());

    app.post('/download', (req, res) => {
      console.log("New Connection");
      const details = req.body;
      req.app.get("db").collection('network').findOne({blockchainId: details.fromId}, (err, depInfo) => {
      if (err) {
        return  res.status(500).json({error: 'Error during department information finding.'});
      }
      console.log(err, depInfo);
      if (!depInfo || !depInfo.availableElements) {
        return res.status(200).json(null);
      }
      const availableElements = depInfo.availableElements.filter(ae => ae.id === details.toId);
      if (availableElements.length === 0) {
        console.log("Department was not granted permission.");
        return res.status(200).json(null);
      }
      async.series([
          function(callback) { //extracting observed values
              let ids = [];
              for (const element of availableElements[0].elements) {
                if (element.type === 2 && element.isChecked) {
                  ids.push(new ObjectId(element._id));
                }
              }
              if (ids.length === 0) {
                callback(null, []);
              } else {
                req.app.get("patientdb").collection('mrelements').find({initialId : { $in: ids }}, {fields:{_id: 1, name: 1, mrId: 1}}).toArray((err, elements) => {
                  if (err) {
                    console.log(err);
                    callback({err: "Error during data extracting occured."})
                  }
                  console.log(elements);
                  ids = elements.map(el => el._id);
                  console.log(ids);
                  req.app.get("patientdb").collection('observedvalues').find({_id : { $in: ids }}, {fields:{showGraph: 0}}).toArray((err, ovalues) => {
                    if (err) {
                      console.log(err);
                      callback({err: "Error during data extracting occured."})
                    }
                    callback(null, {ovInfo: elements, ovDetails: ovalues});
                  });
                });
              }
          }, //extracting questionnaire
          function(callback) {
            let ids = [];
            for (const element of availableElements[0].elements) {
              if (element.type === 0 && element.isChecked) {
                ids.push(new ObjectId(element._id));
              }
            }
            if (ids.length === 0) {
              callback(null, []);
            } else {
              req.app.get("patientdb").collection('mrelements').find({initialId : { $in: ids }}, {fields:{_id: 1, name: 1, mrId: 1}}).toArray((err, elements) => {
                if (err) {
                  console.log(err);
                  callback({err: "Error during data extracting occured."})
                }
                console.log(elements);
                ids = elements.map(el => el._id);
                console.log(ids);
                req.app.get("patientdb").collection('questionnaires').find({_id : { $in: ids }}, {fields:{"questions.hidden": 0, "questions.linkIndex": 0, "questions.linkAnswer": 0}}).toArray((err, qs) => {
                  if (err) {
                    console.log(err);
                    callback({err: "Error during data extracting occured."})
                  }
                  callback(null, {qInfo: elements, qDetails: qs});
                });
              });
            }
          }
      ],
      function(err, result) {
          if (err) {
            return res.status(500).json(err);
          }
          return res.status(200).json({ovalues: result[0], questionnaires: result[1]});
      });

});

    });


MongoClient.connect(config.generationdbMongoUrl, (err, database) => {
  if (err) return console.log(err);
  const medrecDb = database.db('med-rec-generation');
  app.set('db',medrecDb);
  MongoClient.connect(config.managementdbMongoUrl, (err, database2) => {
    if (err) return console.log(err);
    const patientDb = database2.db('med-rec-management');
    app.set('patientdb', patientDb);

    app.listen(config.http_port, (error) => {
      if (error) {
        console.error(error);
      } else {
        console.info('==> ??  Open up http://localhost:%s/ in your browser.', config.http_port);
      }
    });
  });
})
};




initHttpServer();
