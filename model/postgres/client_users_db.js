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
var QueryHelpers = require('./query_helpers.js');

///////////////////////////////////////////////////////
// Const



///////////////////////////////////////////////////////
// Forward Exports
exports.createInstance = function(inName, inConnectString)
{
	LOGINFO("=== POSTGRES CLIENT USERS AUX ===");

	var retObj = new ClientUsersDB(inName, inConnectString);
	return retObj;
};

///////////////////////////////////////////////////////
function ClientUsersDB(inName, inConnectString)
{

	this._mName = inName;
	this._mConnectString = inConnectString;
}

//--------------------------------------------------
// send a user_uuid to delete
ClientUsersDB.prototype.testAPIClearDatabase = function(uuid,callback)
{
	var connectString = this._mConnectString;
	var queryStr = "DELETE from client_users where user_uuid=$1";
	var queryParams = [uuid];

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

			LOGDEBUG("** deleted client_users for API testing **");
			callback(null, resultObj);

		});//query()
	});//connect()

};

//--------------------------------------------------
ClientUsersDB.prototype.createClientUserObj = function(userUUID, docJson)
{
	var retObject = {
		//uid
		//date_create

		"user_uuid": userUUID,
		"document": docJson
	};
	return retObject;
};

//--------------------------------------------------
// saves device info. Will insert or update depending on if exists
ClientUsersDB.prototype.findOne = function(userUUID, callback)
{
	var self = this;

	var queryStr = 'SELECT * from client_users where user_uuid = $1;';
	var queryParams = [userUUID];
	QueryHelpers.findOne(self._mConnectString, queryStr, queryParams, callback);

};

//--------------------------------------------------
// saves device info. Will insert or update depending on if exists
ClientUsersDB.prototype.saveClientUserObject = function(cObj, callback)
{
	var self = this;

	var needsInsert = false;
	var userUUID = cObj["user_uuid"];
	self.findOne(userUUID,function(err, result){

		if(err || !result) {
			needsInsert = true;
		}

		if(needsInsert)
		{
			self.insertClientUserObject(cObj, function(err, result) {
				callback(err, result);
			});//insertClientUserObject
		}
		else
		{
			self.updateClientUserObject(cObj, function(err, result) {
				callback(err, result);
			});//insertClientUserObject
		}

	});//findOne()
};

//--------------------------------------------------
// saves device info. Will insert or update depending on if exists
ClientUsersDB.prototype.insertClientUserObject = function(cObj, callback)
{
	var qObj = createInsertUpdateQuery("INSERT", cObj);
	var queryStr = qObj["queryStr"];
	var queryParams = qObj["queryParams"];

	var self = this;
	QueryHelpers.upsertQuery(self._mConnectString, queryStr, queryParams, callback);
};

//--------------------------------------------------
// saves device info. Will insert or update depending on if exists
ClientUsersDB.prototype.updateClientUserObject = function(cObj, callback)
{
	var qObj = createInsertUpdateQuery("UPDATE", cObj);
	var queryStr = qObj["queryStr"];
	var queryParams = qObj["queryParams"];

	var self = this;
	QueryHelpers.upsertQuery(self._mConnectString, queryStr, queryParams, callback);
};



///////////////////////////////////////////////////////
// Private Util Methods

//-----------------------------------------------------
function createInsertUpdateQuery(inType, cObj)
{
	var queryStr;

	var primaryKey = cObj.user_uuid;
	var queryParams = [
		//cObj.user_uuid,		//REQUIRED
		cObj.document		//REQUIRED

	];

	if(inType == "UPDATE")
	{
		queryStr = "UPDATE client_users SET (document) = ($1) WHERE user_uuid=$2;"
		queryParams.push(primaryKey);
	}
	else
	{

		queryStr = "INSERT INTO client_users(date_create, user_uuid, document) "
			+ "VALUES (now(), $1, $2);";
		queryParams.splice(0, 0, primaryKey);
	}



	var retObj = {
		"queryStr":queryStr,
		"queryParams": queryParams
	};

	return retObj;

}
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
