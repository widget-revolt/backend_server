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

var S = require('string');

var Logger = require("../../log").getLogger();

///////////////////////////////////////////////////////
// Const

var kConfigResult = {
	"foo": "bar"
};


///////////////////////////////////////////////////////
// Forward Exports
exports.createInstance = function(inName, inConnectString)
{
	LOGINFO("=== POSTGRES USERS ===");

	var retObj = new UserDB(inName, inConnectString);
	return retObj;
};

///////////////////////////////////////////////////////
// Private utils
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


///////////////////////////////////////////////////////
function UserDB(inName, inConnectString)
{
	this._mName = inName;
	this._mConnectString = inConnectString;
}

//--------------------------------------------------
// send a user id to delete
UserDB.prototype.testAPIClearDatabase = function(userId,callback)
{
	var connectString = this._mConnectString;
	var queryStr = "DELETE from users where uuid=$1";
	var queryParams = [userId];

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

			LOGDEBUG("** deleted user id **");
			callback(null, resultObj);

		});//query()
	});//connect()

};
//--------------------------------------------------
UserDB.prototype.upsertUserFromQuery = function(inParams, callback)
{
	var self = this;

	// get or create the object
	self.findOne(inParams["uuid"], function(err, result){


		if(err)
		{
			callback(err);
			return;
		}

		// if no result then create
		var needsSave = false;
		var needsInsert = false;


		var userObj = result;
		if(!userObj)
		{
			LOGDEBUG("object not found, creating");

			userObj = {};
			userObj["date_create"] = new Date();
			userObj["odin"] = inParams["odin"];
			userObj["uuid"] = inParams["uuid"];
			userObj["auth"] = inParams["auth"];
			userObj["asid"] = inParams["asid"];

			addOptionalParams(inParams, userObj);

			needsInsert = true;
		}
		else
		{
			LOGDEBUG("updating optional params");

			// see if we have fb info if we didn't have before
			var changeCount = addOptionalParams(inParams, userObj);
			if(changeCount > 0) {
				needsSave = true;
			}
		}

		// if this is new or updated, then save
		if(needsInsert)
		{
			LOGDEBUG("Inserting user record");
			self.insert(userObj, function(err) {

				if(err)
				{
					LOGERROR("Error on user insert");
					callback(err);
					return;

				}

				// ok
				callback(null, true);

			});//insert()
		}
		else if(needsSave)
		{
			self.update(userObj, function(err){

				if(err)
				{
					LOGERROR("Save error on user upsert");
					callback(err);
					return;
				}

				// ok
				callback(null, true);

			});//update()
		}
		else
		{
			// ok
			callback(null, true);
		}

	}); // findUser

};
//--------------------------------------------------
UserDB.prototype.count = function(inQueryStr, queryParams, callback)
{
	LOGDEBUG("userDB count");

	var self = this;
	PG.connect(self._mConnectString, function(err, client, done) {

		if(err) {
			LOGERROR("Error fetching client from pool" + err);
			callback(err);
			return;
		}

		var queryStr = 'SELECT count(*) from users';
		if(inQueryStr) {
			queryStr = 'SELECT count(*) from users where ' + inQueryStr + ';';
		}


		client.query(queryStr, queryParams, function(err, result) {
			//call `done()` to release the client back to the pool
			done();

			if(err) {
				LOGERROR("Error running query, " + err);
				callback(err, -1);
				return;
			}

			// count is the "count" object in the first returned row
			var count = 0;

			try {
				count = parseInt(result.rows[0]["count"]);
			}
			catch(e) {
				LOGERROR("exception getting count result: " + e);
				count = 0;
			}

			callback(null, count);
		});
	});
};

//--------------------------------------------------
// returns a cursor to the result set
// inQueryPartial = a WHERE term
UserDB.prototype.find = function(inQueryPartial, queryParams, limit, offset, callback)
{
	LOGDEBUG("userDB find");

	var self = this;
	PG.connect(self._mConnectString, function(err, client, done) {

		if(err) {
			LOGERROR("Error fetching client from pool" + err);
			callback(err);
			return;
		}

		var queryStr = "SELECT * from users WHERE " + inQueryPartial;

		// add limit and offset
		if(limit != null) {
			queryStr = queryStr + " LIMIT " + limit;
		}
		if(offset != null) {
			queryStr = queryStr + " OFFSET " + offset;
		}
		queryStr += ";";


		client.query(queryStr, queryParams, function(err, result) {
			//call `done()` to release the client back to the pool
			done();

			if(err) {
				LOGERROR("Error running query, " + err);
				callback(err);
				return;
			}

			// any results? - if not put up a log
			var resultObj = null;
			if(result.rows.length == 0) {
				// don't throw an error here.. we just don't have a record
				var errStr = "No records for query";
				LOGERROR(errStr);
			}

			resultObj = result.rows;

			callback(null, resultObj);
		});
	});
};

//--------------------------------------------------
UserDB.prototype.findOne = function(uuid, callback)
{
	LOGDEBUG("looking for uuid:" + uuid);

	var self = this;

	PG.connect(self._mConnectString, function(err, client, done) {

		if(err) {
			LOGERROR("Error fetching client from pool" + err);
			callback(err);
			return;
		}

		client.query('SELECT * from users where uuid = $1;', [uuid], function(err, result) {
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
				var errStr = "No records for uuid: " + uuid;
				LOGERROR(errStr);
			}
			else
			{
				resultObj = result.rows[0];
			}

			LOGDEBUG("found uuid:" + uuid);
			callback(null, resultObj);
		});
	});


};



//--------------------------------------------------
UserDB.prototype.insert = function(userObj, callback)
{
	var qObj = createInsertUpdateQuery("INSERT", userObj);
	var queryStr = qObj["queryStr"];
	var queryParams = qObj["queryParams"];


	var self = this;

	PG.connect(self._mConnectString, function(err, client, done) {

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

			LOGDEBUG("inserted record");
			callback(null, resultObj);
		});//query()
	});//connect()

};

//--------------------------------------------------
UserDB.prototype.update = function(userObj, callback)
{
	var qObj = createInsertUpdateQuery("UPDATE", userObj);
	var queryStr = qObj["queryStr"];
	var queryParams = qObj["queryParams"];


	var self = this;

	PG.connect(self._mConnectString, function(error, client, done) {

		if(error) {
			LOGERROR("Error fetching client from pool" + error);
			callback(error);
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

			LOGDEBUG("updated record");
			callback(null, resultObj);
		});
	});
};

///////////////////////////////////////////////////////
// Private Util Methods

//-----------------------------------------------------
function createInsertUpdateQuery(inType, userObj)
{
	var queryParams = [
		///userObj.uuid,
		userObj.fbid || "",
		userObj.fname || "",
		userObj.lname || "",
		userObj.email || "",
		userObj.birthday || null,
		userObj.gender || "",
		userObj.locale || "",
		userObj.platform || "",
		userObj.osvers  || "",
		userObj.device  || "",
		userObj.carrier  || "",
		userObj.mcc  || "",
		userObj.mnc  || "",
		userObj.idfv  || "",
		userObj.asid  || "",
		userObj.odin  || "",

		userObj.gc_id  || "",
		userObj.gc_alias  || "",
		userObj.gpg_id  || "",
		userObj.gpg_alias  || "",

		userObj.install_tracker_id  || "",
		userObj.install_tracker_name  || "",
		userObj.install_referrer  || "",
		userObj.install_referrer_ip  || ""


	];
	var primaryKey = userObj.uuid;

	var queryStr;
	if(inType == "UPDATE")
	{
		queryStr = "UPDATE users SET (fbid, fname, lname, email, birthday, gender, locale, platform, osvers, device, carrier, mcc, mnc, idfv, asid, odin, gamecenter_id, gamecenter_alias, gpg_id, gpg_alias, install_tracker_id, install_tracker_name, install_referrer, install_referrer_ip) = ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24) where UUID=$25;"
		queryParams.push(primaryKey);
	}
	else
	{
		queryStr = "INSERT INTO users(date_create, uuid, fbid, fname, lname, email, birthday, gender, locale, platform, osvers, device, carrier, mcc, mnc, idfv, asid, odin, gamecenter_id, gamecenter_alias, gpg_id, gpg_alias, install_tracker_id, install_tracker_name, install_referrer, install_referrer_ip) "
			+ "VALUES (now(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25);";
		queryParams.splice(0, 0, primaryKey);
	}



	var retObj = {
		"queryStr":queryStr,
		"queryParams": queryParams
	};

	return retObj;

}

//--------------------------------------------------
// totals up number of added optional params so you can upsert if params have been added
function addOptionalParams(inParams, userObj)
{
	var wasChangedCount = 0;
	wasChangedCount += addOptionalParam(inParams, userObj, "fbid");
	wasChangedCount += addOptionalParam(inParams, userObj, "fname");
	wasChangedCount += addOptionalParam(inParams, userObj, "lname");
	wasChangedCount += addOptionalParam(inParams, userObj, "email");
	wasChangedCount += addOptionalParam(inParams, userObj, "birthday");
	wasChangedCount += addOptionalParam(inParams, userObj, "gender");
	wasChangedCount += addOptionalParam(inParams, userObj, "locale");
	wasChangedCount += addOptionalParam(inParams, userObj, "platform");
	wasChangedCount += addOptionalParam(inParams, userObj, "osvers");
	wasChangedCount += addOptionalParam(inParams, userObj, "device");
	wasChangedCount += addOptionalParam(inParams, userObj, "carrier");
	wasChangedCount += addOptionalParam(inParams, userObj, "mcc");
	wasChangedCount += addOptionalParam(inParams, userObj, "mnc");
	wasChangedCount += addOptionalParam(inParams, userObj, "idfv"); //idfv = identiferForVendors
	wasChangedCount += addOptionalParam(inParams, userObj, "gc_id");//gcid = gamecenter_id
	wasChangedCount += addOptionalParam(inParams, userObj, "gc_alias"); // gcalias = gamecenter_alias
	wasChangedCount += addOptionalParam(inParams, userObj, "gpg_id");//google play games id
	wasChangedCount += addOptionalParam(inParams, userObj, "gpg_alias"); // google play games alias/name

	wasChangedCount += addOptionalParam(inParams, userObj, "install_tracker_id");
	wasChangedCount += addOptionalParam(inParams, userObj, "install_tracker_name");
	wasChangedCount += addOptionalParam(inParams, userObj, "install_referrer");
	wasChangedCount += addOptionalParam(inParams, userObj, "install_referrer_ip");

	return wasChangedCount;

}
//--------------------------------------------------
// adds a parameter to the object and returns 1 if the property was added
function addOptionalParam(inParams, userObj, paramName)
{
	var retValue = 0;
	if(inParams.hasOwnProperty(paramName))
	{
		// make sure we don't overwrite existing data with blank data
		if(userObj.hasOwnProperty(paramName) && userObj[paramName] != "" && inParams[paramName] =="") {
			return 0;
		}

		userObj[paramName] = inParams[paramName];
		retValue = 1;
	}

	return retValue;
}

