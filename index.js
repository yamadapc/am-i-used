#!/usr/bin/env node
'use strict';
var child = require('child_process');
var cheerio = require('cheerio');
var request = require('superagent');

var args = process.argv.slice(process.argv[0] === 'node' ? 2 : 1);
if(!module.parent) main(args);

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
          'Your packages have been downloaded ' + total + ' times last month.'
        );

        console.log(
          'Here\'s a breakdown of that:'
        );

        for(var i = 0, len = ds.length; i < len; i++) {
          console.log(packagenames[i] + ' - ' + ds[i]);
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
      else cb(null, JSON.parse(res.text).downloads);
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
  // Doesn't handle pagination
  request
    .get('https://npmjs.org/browse/author/' + username)
    .end(function(err, res) {
      if(err) return cb(err);

      var $ = cheerio.load(res.text);
      var packagenames = getPackagesFromHtml($);
      cb(null, packagenames);
    });
}
exports.getPackagesFromNpm = getPackagesFromNpm;

function getPackagesFromHtml($) {
  return $('ul.collaborated-packages li a')
    .map(function(i, el) {
      var m = /package\/(.+)/.exec($(el).attr('href'));
      return m && m[1];
    })
    .filter(function(i, el) {
      return !!el;
    })
    .get();
}
exports.getPackagesFromHtml = getPackagesFromHtml;

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
