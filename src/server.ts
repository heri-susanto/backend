import 'reflect-metadata';
import { createConnection } from 'typeorm';
import http from 'http';
import express from 'express';
import { applyMiddleware, applyRoutes } from './utils';
import middleware from './middleware';
import errorHandlers from './middleware/errorHandlers';
import routes from './services';
import cluster from 'cluster';

const router = express();

//Connects to the Database -> then starts the express
const server = () => {
  return createConnection()
    .then(async connection => {
      process.on('uncaughtException', e => {
        console.log(e);
        process.exit(1);
      });

      process.on('unhandledRejection', e => {
        console.log(e);
        process.exit(1);
      });

      applyMiddleware(middleware, router);
      applyRoutes(routes, router);
      applyMiddleware(errorHandlers, router);

      const { PORT = 3000 } = process.env;
      const server = http.createServer(router);

      server.listen(PORT, () =>
        console.log(`Server is running in port ${PORT}`)
      );
    })
    .catch(error => console.log(error));
};
let workers: any = [];

/**
 * Setup number of worker processes to share port which will be defined while setting up server
 */
const setupWorkerProcesses = () => {
  // to read number of cores on system
  let numCores = require('os').cpus().length;
  console.log('Master cluster setting up ' + numCores + ' workers');

  // iterate on number of cores need to be utilized by an application
  // current example will utilize all of them
  for (let i = 0; i < numCores; i++) {
    // creating workers and pushing reference in an array
    // these references can be used to receive messages from workers
    workers.push(cluster.fork());

    // to receive messages from worker process
    workers[i].on('message', function(message: any) {
      console.log(message);
    });
  }

  // process is clustered on a core and process id is assigned
  cluster.on('online', function(worker) {
    console.log('Worker ' + worker.process.pid + ' is listening');
  });

  // if any of the worker process dies then start a new one by simply forking another one
  cluster.on('exit', function(worker, code, signal) {
    console.log(
      'Worker ' +
        worker.process.pid +
        ' died with code: ' +
        code +
        ', and signal: ' +
        signal
    );
    console.log('Starting a new worker');
    workers.push(cluster.fork());
    // to receive messages from worker process
    workers[workers.length - 1].on('message', function(message: any) {
      console.log(message);
    });
  });
};

/**
 * Setup server either with clustering or without it
 * @param isClusterRequired
 * @constructor
 */
const setupServer = (isClusterRequired: boolean) => {
  // if it is a master process then call setting up worker process
  if (isClusterRequired && cluster.isMaster) {
    setupWorkerProcesses();
  } else {
    // to setup server configurations and share port address for incoming requests
    server();
  }
};

setupServer(true);
