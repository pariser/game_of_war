var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

var mongoose = require('mongoose');
var MONGO_SERVER = process.env.MONGOLAB_URI || "mongodb://localhost/game-of-war";

require('./models/game');

var gameRoutes = require('./routes/games');

var app = express();

mongoose.connection.on('connected', function() {
  console.log("DB: " + MONGO_SERVER + " connected");

  // view engine setup
  app.set('views', path.join(__dirname, 'views'));
  app.set('view engine', 'jade');

  // uncomment after placing your favicon in /public
  //app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
  app.use(logger('dev'));
  app.use(bodyParser.json());
  app.use(cookieParser());
  app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
  });
  app.use(express.static(path.join(__dirname, 'public')));

  app.get('/health/basic.json', function(req, res) {
    res.send({
      success: true
    });
  });

  app.use('/games', gameRoutes);

  // catch 404 and forward to error handler
  app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
  });

  // error handlers

  // development error handler
  // will print stacktrace
  if (app.get('env') === 'development') {
    app.use(function(err, req, res, next) {
      res.status(err.status || 500);
      res.render('error', {
        message: err.message,
        error: err
      });
    });
  }

  // production error handler
  // no stacktraces leaked to user
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: {}
    });
  });
});

mongoose.connection.on("error", function(err) {
  console.error('DB: ' + MONGO_SERVER + ' threw error on startup ', err);
});

// When the connection is disconnected
mongoose.connection.on('disconnected', function () {
  console.log('DB: ' + MONGO_SERVER + ' disconnected');
});

function gracefulExit() {
  mongoose.connection.close(function () {
    console.log('DB:' + MONGO_SERVER + ' disconnected through app termination');
    process.exit(0);
  });
}

process.
  on('SIGINT', gracefulExit).
  on('SIGTERM', gracefulExit);

try {
  mongoose.connect(MONGO_SERVER);
  console.log('DB: ' + MONGO_SERVER + ' trying to connect');
} catch(err) {
  console.error('DB: ' + MONGO_SERVER + ' failed during initialization');
}

module.exports = app;
