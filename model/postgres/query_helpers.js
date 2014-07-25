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
var util = require('util');

var ServerConfig = require("../../config").ServerConfig;
var PG = require('pg');
if(ServerConfig.DEPLOY_ENVIRONMENT != "development") {
	PG = require('pg').native;
}

var Logger = require("../../log").getLogger();

//-----------------------------------------------------
exports.findOne = function(connectString, queryStr, queryParams, callback)
{

	PG.connect(connectString, function(err, client, done) {

		if(err) {
			LOGERROR("Error fetching client from pool" + err);
			callback(err);
			return;
		}

		client.query(queryStr, queryParams, function(err, result) {
			//call `done()` to release the client back to the pool
			done();

			if(err) {
				LOGERROR("Error running query, " + err);
				callback(err);
				return;
			}

			// any results?
			var resultObj = null;
			if(result.rows.length == 0) {
				// don't throw an error here.. we just don't have a record
				var errStr = "No records found";
				LOGERROR(errStr);
			}
			else
			{
				resultObj = result.rows[0];
			}

			callback(null, resultObj);
		});//query()
	});//connect()
};

//-----------------------------------------------------
exports.upsertQuery = function(connectString, queryStr, queryParams, callback)
{

	PG.connect(connectString, function(err, client, done) {

		if(err) {
			LOGERROR("Error fetching client from pool" + err);
			callback(err);
			return;
		}

		client.query(queryStr, queryParams, function(err, result) {
			//call `done()` to release the client back to the pool
			done();

			if(err) {
				LOGERROR("Error running query, " + err);
				callback(err);
				return;
			}

			// any results?
			var resultObj = result;

			LOGDEBUG("updated/inserted record");
			callback(null, resultObj);

		});//query()
	});//connect()
};

//-----------------------------------------------------

exports.makeWhereInClause = function(fieldStr, startParamIndex, includeSetArray)
{
	// build up the WHERE...IN clause prepared statement
	var baseParamNum = startParamIndex;
	var psArray = [];
	var len = includeSetArray.length;
	for(var i = 0; i < len; i++) {
		var pstr = "$" + (baseParamNum + i);
		psArray.push(pstr);
	}
	var whereInStr = "(" + fieldStr + " in (" + psArray.join(",") + "))";

	return whereInStr;
};
//-----------------------------------------------------
function LOGINFO(s) {
	Logger.info("Database", s);
}
//-----------------------------------------------------
function LOGDEBUG(s) {
	Logger.debug("Database", s);
}
//-----------------------------------------------------
function LOGERROR(s) {
	Logger.error("Database", s, false);
}
//-----------------------------------------------------
function LOGCRITICAL(s) {
	Logger.error("Database", s, true);
}