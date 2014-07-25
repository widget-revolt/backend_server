//
//	Copyright (c) 2014 Widget Revolt LLC.  All rights reserved
//
//	Permission is hereby granted, free of charge, to any person obtaining a copy
//	of this software and associated documentation files (the "Software"), to deal
//	in the Software without restriction, including without limitation the rights
//	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
//	copies of the Software, and to permit persons to whom the Software is
//	furnished to do so, subject to the following conditions:
//
//	The above copyright notice and this permission notice shall be included in
//	all copies or substantial portions of the Software.
//
//	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
//	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
//	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
//	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
//	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
//	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
//	THE SOFTWARE.


"use strict";

var LogConfig = require('./config').LogConfig;
var ServerConfig = require("./config").ServerConfig;
var winston = require('winston');

var _staticLoggerInstance = null;	// static instance 

var _log = null;

exports.getLogger = function()
{
	if(!_staticLoggerInstance) {
		_staticLoggerInstance = new _Logger();
		console.log("instantiating logger");
	}

	return(_staticLoggerInstance);
}

///////////////////////////////////////////////////////
function _Logger()
{
	var logLevel = 'info';

	if(ServerConfig.SERVER_DEBUG) {
		console.log("log set to debug");
		logLevel = 'debug';
	}

	var useJSON = false;
	var useColors = true;
	if(ServerConfig.DEPLOY_ENVIRONMENT == "production" || ServerConfig.DEPLOY_ENVIRONMENT == "staging")
	{
		//useJSON = true;
		//winston.cli();
		useColors = false; //Nodejitsu having bug with colors
	}

	var logSettings =
	{
		transports:
		[
			new (winston.transports.Console)(
				{
					level: logLevel,
					colorize: useColors,
					json: useJSON
				}
			)
		]
 	};


	_log = new winston.Logger(logSettings);

	_log.debug("log debug enabled");
	_log.info("log info enabled");
	_log.warn("log warn enabled");
	_log.error("log error enabled");
	console.log("log initialized");
}
//----------------------------------------------
_Logger.prototype.debug = function(logClass, str)
{
	if(LogConfig.hasOwnProperty(logClass) && LogConfig[logClass]) {
		_log.debug(str);
	}
}
//----------------------------------------------
_Logger.prototype.info = function(logClass, str)
{
	if(LogConfig.hasOwnProperty(logClass) && LogConfig[logClass]) {
		_log.info(str);
	}
}
//----------------------------------------------
_Logger.prototype.warn = function(logClass, str)
{
	if(LogConfig.hasOwnProperty(logClass) && LogConfig[logClass]) {
		_log.warn(str);
	}
}
//----------------------------------------------
_Logger.prototype.error = function(logClass, str, critical)
{
	if(LogConfig.hasOwnProperty(logClass) && LogConfig[logClass]) {
		_log.error(str);
	}

	if(critical)
	{
		console.error("***************************************************");
		console.error("*** CRITICAL ERROR");
		console.error(str);
		console.error("***************************************************");
		// TODO: Make better
		//console.log('Oops. you lose. Maybe some code should be added her to notify someone?');
	}
}



