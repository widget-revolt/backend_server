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
	LOGINFO("=== POSTGRES DEVICES ===");

	var retObj = new DevicesDB(inName, inConnectString);
	return retObj;
};

///////////////////////////////////////////////////////
function DevicesDB(inName, inConnectString)
{

	this._mName = inName;
	this._mConnectString = inConnectString;
}

//--------------------------------------------------
// send a user_uuid to delete
DevicesDB.prototype.testAPIClearDatabase = function(uuid,callback)
{
	var connectString = this._mConnectString;
	var queryStr = "DELETE from devices where user_uuid=$1";
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

			LOGDEBUG("** deleted devices for API testing **");
			callback(null, resultObj);

		});//query()
	});//connect()

};

//--------------------------------------------------
// send a user_uuid to delete
DevicesDB.prototype.testClearDatabase = function(callback)
{
	var connectString = this._mConnectString;
	var queryStr = "DELETE from devices";
	var queryParams = [];

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

			LOGDEBUG("** deleted devices for API testing **");
			callback(null, resultObj);

		});//query()
	});//connect()

};

//--------------------------------------------------
DevicesDB.prototype.createDeviceObject = function(userUUID,
												  deviceId,
												  apnsToken,
												  language,
												  country,

												  timeZone,
												  platform,
												  osVers,
												  device,
												  carrier,

												  mcc,
												  mnc,
												  imei,

												  apid,
												  push_tags
												  )
{
	var retObject = {
		//uid
		//date_create

		"user_uuid": userUUID,
		"device_id": deviceId,

		"apns_token": apnsToken || "",
		"language": language || "",
		"country": country || "",
		"time_zone": timeZone || 0,

		"platform": platform || "",
		"osvers": osVers || "",
		"device": device || "",
		"carrier": carrier || "",
		"mcc": mcc || "",
		"mnc": mnc || "",
		"imei": imei || "",
		"apid": apid || "",
		"push_tags": push_tags || "",
		"push_disabled": "f"
	};
	return retObject;
};


//--------------------------------------------------
// saves device info. Will insert or update depending on if exists
DevicesDB.prototype.saveDeviceObject = function(deviceInfoObj, callback)
{
	var self = this;

	var needsInsert = false;
	var userUUID = deviceInfoObj["user_uuid"];
	var deviceId = deviceInfoObj["device_id"];
	self.findOne(userUUID, deviceId, function(err, result){

		if(err || !result) {
			needsInsert = true;
		}

		if(needsInsert)
		{
			self.insertDeviceObject(deviceInfoObj, function(err, result) {
				callback(err, result);
			});//insertDeviceObject
		}
		else
		{
			self.updateDeviceObject(deviceInfoObj, function(err, result) {
				callback(err, result);
			});//insertDeviceObject
		}

	});//findOne()
};
//--------------------------------------------------
// saves device info. Will insert or update depending on if exists
DevicesDB.prototype.findOne = function(userUUID, deviceId, callback)
{
	var self = this;
	var queryStr = "SELECT * from devices where user_uuid = $1 AND device_id = $2;";
	var queryParams = [userUUID, deviceId];
	QueryHelpers.findOne(self._mConnectString, queryStr, queryParams, callback);

};
//--------------------------------------------------
// saves device info. Will insert or update depending on if exists
DevicesDB.prototype.insertDeviceObject = function(deviceObject, callback)
{
	var qObj = createInsertUpdateQuery("INSERT", deviceObject);
	var queryStr = qObj["queryStr"];
	var queryParams = qObj["queryParams"];

	var self = this;
	QueryHelpers.upsertQuery(self._mConnectString, queryStr, queryParams, callback);
};
//--------------------------------------------------
// saves device info. Will insert or update depending on if exists
DevicesDB.prototype.updateDeviceObject = function(deviceObject, callback)
{
	var qObj = createInsertUpdateQuery("UPDATE", deviceObject);
	var queryStr = qObj["queryStr"];
	var queryParams = qObj["queryParams"];

	var self = this;
	QueryHelpers.upsertQuery(self._mConnectString, queryStr, queryParams, callback);
};

///////////////////////////////////////////////////////
// Private Util Methods

//-----------------------------------------------------
function createInsertUpdateQuery(inType, deviceObj)
{
	/*
	 "user_uuid": userUUID,
	 "device_id": deviceId,

	 "apns_token": apnsToken || "",
	 apid text;					-- gcm token
	 push_tags text;
	 push_disabled boolean,

	 "language": language || "",
	 "country": country || "",
	 "time_zone": timeZone || "",

	 "platform": platform || "",
	 "osvers": osvers || "",
	 "device": device || "",
	 "carrier": carrier || "",
	 "mcc": mcc || "",
	 "mnc": mnc || "",
	 "imei": imei || ""
	 */
	var queryParams = [
		//deviceObj.user_uuid,		//REQUIRED
		deviceObj.device_id,		//REQUIRED

		deviceObj.apns_token,

		deviceObj.language,
		deviceObj.country,
		deviceObj.time_zone,
		deviceObj.platform,

		deviceObj.osvers,
		deviceObj.device,
		deviceObj.carrier,
		deviceObj.mcc,
		deviceObj.mnc,
		deviceObj.imei,

		deviceObj.apid,
		deviceObj.push_tags,
		deviceObj.push_disabled

	];

	var primaryKey = deviceObj.user_uuid;

	var queryStr;
	if(inType == "UPDATE")
	{
		queryStr = "UPDATE devices SET (device_id, apns_token, language, country, time_zone, platform, osvers, device, carrier, mcc, mnc, imei, apid, push_tags, push_disabled) = ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) WHERE user_uuid=$16;";
		queryParams.push(primaryKey);
	}
	else
	{
		queryStr = "INSERT INTO devices(date_create, user_uuid, device_id, apns_token, language, country, time_zone, platform, osvers, device, carrier, mcc, mnc, imei, apid, push_tags, push_disabled) "
			+ "VALUES (now(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,$16);";
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
