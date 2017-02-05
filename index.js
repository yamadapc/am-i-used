#!/usr/bin/env node
'use strict';
var async = require('async');
var child = require('child_process');
var path = require('path');
var request = require('superagent');

var args = process.argv.slice(
  ['node', 'nodejs', 'jx', 'iojs'].indexOf(
    path.basename(process.argv[0])
  ) !== -1 ? 2 : 1
);
if(!module.parent) main(args);

function commaNum(n) {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function main(args) {
  if(args.indexOf('-h') !== -1 || args.indexOf('--help') !== -1) {
    console.log('Usage: am-i-used');
  }
  if(args.length) {
    return eachSeries(args, reportUse, exit);
  }

  getCurrentNpmUser(function(err, username) {
    if(err) return exit(err);
    reportUse(username, exit);
  });

  function reportUse(username, cb) {
    console.log('Hey there ' + username + '!');
    console.log('Let\'s see what you\'ve written...');

    getPackagesFromNpm(username, function(err, packagenames) {
      if(err) return cb(err);

      console.log(
        'Found ' + packagenames.length + ' packages you\'ve published to NPM'
      );

      mapAsync(packagenames, getPackageDownloads, function(err, ds) {
        if(err) return cb(err);

        var total = ds.reduce(function(x, m) { return x + m; }, 0);

        console.log(
          'Your packages have been downloaded ' + commaNum(total) + ' times last month.'
        );

        console.log(
          'Here\'s a breakdown of that:'
        );

        for(var i = 0, len = ds.length; i < len; i++) {
          console.log(packagenames[i] + ' - ' + commaNum(ds[i]));
        }

        cb();
      });
    });
  }
}
exports.main = main;

function getPackageDownloads(packagename, cb) {
  request
    .get('https://api.npmjs.org/downloads/point/last-month/' + packagename)
    .end(function(err, res) {
      if(err) cb(err);
      else cb(null, JSON.parse(res.text).downloads || 0);
    });
}
exports.getPackageDownloads = getPackageDownloads;

function getCurrentNpmUser(cb) {
  child.exec('npm whoami', [], function(err, stdout/*, stderr*/) {
    if(err) cb(err);
    else cb(null, stdout.toString().slice(0, -1));
  });
}
exports.getCurrentNpmUser = getCurrentNpmUser;

function getPackagesFromNpm(username, cb) {
  var hasMore = true;
  var offset = 0;
  var packages = [];
  async.whilst(
    function () {
      return hasMore;
    },
    function (cb) {
      request
        .get('https://www.npmjs.com/profile/' + username + '/packages?offset=' + offset++)
        .end(function (err, res) {
          if (err) return cb(err);
          var result = JSON.parse(res.text);
          hasMore = result.hasMore;
          packages.push(result.items.map(function (item) { return item.name }));
          cb(null);
        });
    },
    function (err) {
      if (err) return cb(err);
      cb(null, [].concat.apply([], packages));
    });
}
exports.getPackagesFromNpm = getPackagesFromNpm;

function eachSeries(arr, fn, cb) {
  var counter = 0;
  var len = arr.length;
  var called = false;

  loop(null);

  function loop(err) {
    if(called) {
      return;
    }
    else if(err) {
      cb(err);
      called = true;
    }

    if(counter < len) {
      fn(arr[counter++], loop);
    }
    else {
      cb(null);
    }
  }
}
exports.eachSeries = eachSeries;

function mapAsync(arr, fn, cb) {
  var counter = 1;
  var ret = [];
  var len = arr.length;
  var called = false;

  for(var i = 0, l = arr.length; i < l; i++) {
    fn(arr[i], loop.bind(null, i));
  }

  function loop(i, err, res) {
    if(called) return;
    else if(err) {
      cb(err);
      called = true;
    }

    ret[i] = res;
    if(counter >= len) {
      cb(null, ret);
      called = true;
    }
    else {
      counter += 1;
    }
  }
}
exports.mapAsync = mapAsync;

function exit(err) {
  if(err) {
    console.error(err.message || err);
    process.exit(1);
  }
  else {
    process.exit(0);
  }
}
exports.exit = exit;
