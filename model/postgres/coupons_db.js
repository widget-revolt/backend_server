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
var crypto = require('crypto');
var querystring = require("querystring");

var ServerConfig = require("../../config").ServerConfig;
var PG = require('pg');
if(ServerConfig.DEPLOY_ENVIRONMENT != "development") {
	PG = require('pg').native;
}

var Logger = require("../../log").getLogger();
var Utils = require("../../lib/utils.js");



//-----------------
// This uses a fixed table for now.  It should be shared between the admin and backend
var COUPON_DATA = require("../../shared_static_data.js").COUPON_DATA;


///////////////////////////////////////////////////////
// Const




///////////////////////////////////////////////////////
// Forward Exports
exports.createInstance = function(inName, inConnectString)
{
	LOGINFO("=== POSTGRES COUPONS ===");

	var retObj = new CouponsDB(inName, inConnectString);
	return retObj;
};



///////////////////////////////////////////////////////
function CouponsDB(inName, inConnectString)
{

	this._mName = inName;
	this._mConnectString = inConnectString;

	this._mCouponTypes = COUPON_DATA;
}

//--------------------------------------------------
CouponsDB.prototype.findAllForUser = function(uuid, callback)
{

	LOGDEBUG("looking for uuid:" + uuid);

	var self = this;

	PG.connect(self._mConnectString, function(err, client, done) {

		if(err) {
			LOGERROR("Error fetching client from pool" + err);
			callback(err);
			return;
		}
		//result.sort( {date_create:-1, redeemed: 1} );
		client.query('SELECT * from coupons where uuid = $1 ORDER BY date_create DESC, redeemed ASC;', [uuid], function(err, result) {
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

			resultObj = result.rows;

			callback(null, resultObj);
		});//query()
	});


};

//--------------------------------------------------
CouponsDB.prototype.createCouponForUserWithType = function(uuid, couponId, email, callback)
{
	var now = new Date();
	var couponRecord = {
		"date_create": now,
		"uuid": uuid,
		"coupon_id": couponId,
		"email": email,
		"redeemed": false,
		"coupon_code": "",
		"coupon_code_urlsafe": "",
		"redeem_date": null
	};

	var self = this;

	var couponData = null;
	try {
		couponData = self._mCouponTypes[self._mName][couponId];
	}
	catch(e) {
		couponData = null;
	}

	if(couponData == null) {
		var errStr = "Cannot lookup couponId:" + couponId;
		LOGERROR(errStr);
		callback(errStr, null);
		return;
	}
	var couponCode = createCouponCode(couponRecord, couponData);
	var couponCodeQuery = querystring.stringify({t: couponCode});
	couponRecord["coupon_code"] = couponCode;
	couponRecord["coupon_code_urlsafe"] = couponCodeQuery;

	// save the coupon
	self.insert(couponRecord, function(err, result) {
		if(err)
		{
			LOGERROR("Save error on coupon create");
			callback(err, null);
			return;
		}

		// ok
		callback(null, couponRecord);

	});//insert()



};

//--------------------------------------------------
CouponsDB.prototype.getAvailableCouponTypes = function()
{
	var couponTypes = this._mCouponTypes[this._mName];
	return(couponTypes);

};

//--------------------------------------------------
CouponsDB.prototype.insert = function(couponObj, callback)
{
	//
	var qObj = createInsertUpdateQuery("INSERT", couponObj);
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
			//call done() to release the client back to the pool
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
CouponsDB.prototype.update = function(couponObj, callback)
{
	//
	var qObj = createInsertUpdateQuery("UPDATE", couponObj);
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
			//call done() to release the client back to the pool
			done();

			if(err) {
				LOGERROR("Error running query, " + err);
				callback(err);
				return;
			}

			// any results?
			var resultObj = result;

			LOGDEBUG("updated coupon record");
			callback(null, resultObj);
		});//query()
	});//connect()
};

//--------------------------------------------------
CouponsDB.prototype.redeemCoupon = function(uuid, couponCode, salt, callback)
{
	var self = this;

	PG.connect(self._mConnectString, function(err, client, done) {

		if(err) {
			LOGERROR("Error fetching client from pool" + err);
			callback(err);
			return;
		}

		var queryStr = "SELECT * FROM coupons WHERE uuid=$1 AND coupon_code=$2";
		var queryParams = [uuid, couponCode];
		client.query(queryStr, queryParams, function(err, result) {
			//call done() to release the client back to the pool
			done();

			if(err) {
				LOGERROR("Error running query, " + err);
				callback(err);
				return;
			}
			if(result.rows.length == 0) {
				var nfErr = "Not found";
				LOGERROR("Error running query, " + nfErr);
				callback(nfErr);
				return;
			}

			// redeemed?
			var couponRecord = result.rows[0];
			if(couponRecord.redeemed == true) {
				var partialCode = couponCode.substring(0,10) + "xxxxxx";
				var errStr = "Coupon already redeemed: " + partialCode;
				LOGERROR(errStr);
				callback(errStr, null);
				return;
			}

			// ok...we found it...mark it as redeemed
			couponRecord.redeemed = true;
			self.update(couponRecord, function(err) {

				if(err) {
					var errStr = "Error redeeming coupon: " + err;
					LOGERROR(errStr);
					callback(errStr, null);
					return;
				}

				// yay...now make a hash with the salt and we're done
				var redemptionHash = makeRedemptionHash(uuid, salt);
				callback(null, redemptionHash);

			});//save()

		});//query()
	});//connect()


};

/***


//--------------------------------------------------
CouponsDB.prototype.getCouponCodeForId = function(mongoId, callback)
{
	var self = this;
	self._mCollection.findOne( {_id: new ObjectID(mongoId)}, function(error, result) {

		if(error)
		{
			var errStr = "No records for uuid: " + error;
			LOGERROR(errStr);
			callback(error);
			return;
		}

		if(!result)
		{
			var errStr = "No records for uuid: " + uuid;
			LOGERROR(errStr);
			callback(errStr, null);
			return;
		}



		callback(null, result["coupon_code"]);
	} );
};


 */

///////////////////////////////////////////////////////
// Private Util Methods

//-----------------------------------------------------
function createInsertUpdateQuery(inType, couponObj)
{
	/*
	 "date_create": now,
	 "uuid": uuid,
	 "coupon_id": couponId,
	 "email": email,
	 "redeemed": false,
	 "coupon_code": "",
	 "coupon_code_urlsafe": "",
	 "redeem_date": null
	 */
	var queryParams = [
		//couponObj.uuid,			//required
		couponObj.coupon_id,	//required
		couponObj.email,		//required
		couponObj.redeemed,
		couponObj.coupon_code || "",
		couponObj.coupon_code_urlsafe || ""

	];
	var primaryKey = couponObj.uuid;

	var queryStr;
	if(inType == "UPDATE")
	{
		queryStr = "UPDATE coupons SET (coupon_id, email, redeemed, coupon_code, coupon_code_urlsafe, redeem_date) = ($1, $2, $3, $4, $5, now()) WHERE (uuid=$6 AND coupon_code=$7);"
		queryParams.push(primaryKey);
		queryParams.push(couponObj.coupon_code);
	}
	else
	{
		queryStr = "INSERT INTO coupons(date_create,  uuid, coupon_id, email, redeemed, coupon_code, coupon_code_urlsafe, redeem_date) "
			+ "VALUES (now(), $1, $2, $3, $4, $5, $6, null);";
		queryParams.splice(0, 0, primaryKey);
	}


	var retObj = {
		"queryStr":queryStr,
		"queryParams": queryParams
	};

	return retObj;

}

function makeRedemptionHash(uuid, salt)
{
	var hashString = "coupon" + salt + uuid;
	var sha256 = crypto.createHash("sha256");
	sha256.update(hashString, "utf8");//utf8 here
	var result = sha256.digest("base64");

	return result;
}

function createCouponCode(couponRecord, couponData)
{
	// get the hash
	var hash = getCouponHash(couponRecord, couponData);

	return hash;

}
//--------------------------------------------------
//"date_create": now,
//	"uuid": uuid,
//	"coupon_id": couponId,
//	"email": email,
//	"redeemed": false,
//	"redeem_date": null
function getCouponHash(couponRecord, couponData)
{
	var hashObj = {
		"date_create":couponRecord["date_create"],
		"coupon_id": couponRecord["coupon_id"],
		"email": couponRecord["email"],
		"salt": couponData["salt"]
	};

	var hashStr = JSON.stringify(hashObj);

	var sha256 = crypto.createHash("sha256");
	sha256.update(hashStr, "utf8");//utf8 here
	var result = sha256.digest("base64");

	return result;

}

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