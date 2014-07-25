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
var Utils = require("../../lib/utils.js");

//-----------------
// sample
//	{
//		"status": "<active|pending|inactive>",
//		"version": "inactive",
//		"data": {
// 			...
// 		}
//	}

///////////////////////////////////////////////////////
// Const
var eStatus = {
	INACTIVE: "inactive",
	PENDING: "pending",
	ACTIVE: "active"
};


///////////////////////////////////////////////////////
// Forward Exports
exports.createInstance = function(inName, inConnectString)
{
	LOGINFO("=== POSTGRES AppConfigDB ===");

	var retObj = new AppConfigDB(inName, inConnectString);
	return retObj;
};



///////////////////////////////////////////////////////
function AppConfigDB(inName, inConnectString)
{
	this.mName = inName;
	this.mConnectString = inConnectString;
}

//--------------------------------------------------
// used for admin lists
AppConfigDB.prototype.findAllAsJSON = function(callback)
{
	var self = this;
	PG.connect(self.mConnectString, function(err, client, done) {

		if(err) {
			LOGERROR("Error finding ALL AppConfigDB");
			callback(err, null);
			return;
		}


		var queryStr = "SELECT * FROM appconfig ORDER BY status ASC, version DESC";
		var queryParams = [];

		client.query(queryStr, queryParams, function(err, result) {

			//call `done()` to release the client back to the pool
			done();

			if(err) {
				LOGERROR("Error finding ALL AppConfigDB");
				callback(err, null);
				return;
			}

			// convert to array and return
			callback(null, result.rows);

		});//query()
	});//connect()

};
//--------------------------------------------------
// will return error if not found
AppConfigDB.prototype.findOne = function(uid, callback)
{
	LOGDEBUG("looking for appconfig:" + uid);

	var self = this;
	PG.connect(self.mConnectString, function(err, client, done) {

		if(err) {
			LOGERROR("Error finding in AppConfigDB");
			callback(err, null);
			return;
		}


		var queryStr = "SELECT * FROM appconfig WHERE uid=$1";
		var queryParams = [uid];

		client.query(queryStr, queryParams, function(err, result) {

			//call `done()` to release the client back to the pool
			done();

			if(err) {
				LOGERROR("Error finding ALL AppConfigDB");
				callback(err, null);
				return;
			}

			if(result.rows.length == 0) {
				callback("Item not found: " + uid, null);
				return;
			}

			// return first object
			callback(null, result.rows[0]);

		});//query()
	});//connect()
};
//--------------------------------------------------
AppConfigDB.prototype.getActiveConfig = function(callback)
{
	this.getConfigOfType(eStatus.ACTIVE, callback);


};
//--------------------------------------------------
AppConfigDB.prototype.getPendingConfig = function(callback)
{
	this.getConfigOfType(eStatus.PENDING, callback);


};
//--------------------------------------------------
AppConfigDB.prototype.getConfigOfType = function(configStatus, callback)
{
	var errObj = {"error": "generic error retrieving config"};


	// find all active, order by version (desc) and then return the first obj
	var self = this;


	PG.connect(self.mConnectString, function(err, client, done) {

		if(err) {
			LOGERROR("Error fetching client from pool" + err);
			//NOTE: we jam the error in the obj since this will be a json return
			errObj["error"] = err;
			callback(err, errObj);
			return;
		}

		var queryStr = "SELECT * FROM appconfig WHERE status=$1 ORDER BY version DESC LIMIT 10;";
		var queryParams = [configStatus];

		client.query(queryStr, queryParams, function(err, result) {

			//call `done()` to release the client back to the pool
			done();

			if(err) {
				errObj["error"] = err;
				callback(err, errObj);
				return;
			}

			// any results?
			if(result.rows.length == 0) {
				err = "No records found";
				errObj["error"] = "no results found";
				callback(err, errObj);
			}

			// massage the data
			var retObj = {};
			try {
				var item = result.rows[0];
				var configData = item["data"]
				retObj = configData;
				retObj["version"] = item["version"];
			}
			catch(e) {
				retObj["error"] = "Cannot decode json";
			}

			callback(null, retObj);

		});
	});

};

//--------------------------------------------------
AppConfigDB.prototype.insertRecordWithParams = function(versionString,description,configData,callback)
{
	var self = this;

	PG.connect(self.mConnectString, function(err, client, done) {

		if(err) {
			LOGERROR("Error inserting in AppConfigDB");
			callback(err, null);
			return;
		}


		var queryStr = "INSERT INTO appconfig (date_create, status, version, description, data)";
			queryStr += " VALUES (now(), $1, $2, $3, $4);";

		var queryParams = [eStatus.INACTIVE, versionString, description, configData];

		client.query(queryStr, queryParams, function(err, result) {

			//call `done()` to release the client back to the pool
			done();

			if(err) {
				LOGERROR("Error inserting into AppConfigDB");
				callback(err, null);
				return;
			}

			// return first object
			callback(null, result);

		});//query()
	});//connect()

};

//--------------------------------------------------
// There can be ONLY ONE highxxxx - ONLY ONE active or pending
AppConfigDB.prototype.setStatus = function(uid, status, callback)
{
	var validStatus = {
		"active": 1,
		"pending": 1,
		"inactive": 1
	};
	if(!validStatus[status])
	{
		var errStr = "setStatus, invalid status: " + status;
		LOGERROR(errStr);
		callback(errStr);
		return;
	}

	// write with confirm
	var self = this;
	var bStatus = status;
	self.findOne(uid, function(err, result) {

		if(err)
		{
			LOGERROR("setStatus failed, cant find uid: " + err);
			callback(err);
			return;
		}

		//TODO: transaction
		// update that to active
		var queryStr = "UPDATE appconfig SET status=$1 WHERE uid=$2";
		var queryParams = [bStatus, uid];

		self.update(queryStr, queryParams, function(err, result) {

			if(err) {
				LOGERROR("Error updating AppConfigDB");
				callback(err, null);
				return;
			}

			// if we are making active, then deactivate others
			if(bStatus == "active" )
			{
				queryStr = "UPDATE appconfig SET status=$1 WHERE uid <> $2";
				queryParams = ["inactive", uid];

				self.update(queryStr, queryParams, function(err, result) {
					if(err) {
						LOGERROR("Error updating AppConfigDB");
						callback(err, null);
						return;
					}

					if(err) {
						LOGERROR("*** Failed to demote other items...oh well? **");
						LOGERROR(err);
						return;
					}

					if(result) {
						LOGDEBUG("awesome, updated");
					}

					callback(null);
				});
			}
			else
			{
				callback(null);
			}

		});//update()



	});//findOne()


};
//--------------------------------------------
AppConfigDB.prototype.update = function(queryStr, queryParams, callback)
{
	var self = this;
	PG.connect(self.mConnectString, function(err, client, done) {

		if(err) {
			LOGERROR("Error connecting appconfig");
			callback(err, null);
			return;
		}

		client.query(queryStr, queryParams, function(err, result) {

			//call `done()` to release the client back to the pool
			done();

			if(err) {
				LOGERROR("Error updating AppConfigDB");
				callback(err, null);
				return;
			}

			// return first object
			callback(null, result);

		});//query()
	});//connect()
};

///////////////////////////////////////////////////////
// Private Util Methods


function LOGINFO(s) {
	Logger.info("Database", s);
}
function LOGDEBUG(s) {
	Logger.debug("Database", s);
}
function LOGERROR(s) {
	Logger.error("Database", s, false);
}

function LOGCRITICAL(s) {
	Logger.error("Database", s, true);
}
