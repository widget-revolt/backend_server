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



var https = require("https");
var util = require("util");

var Utils = require("./utils.js");
var Logger = require("../log.js").getLogger();

var kProductionHost = "buy.itunes.apple.com";
var kSandboxHost = "sandbox.itunes.apple.com";

var kResponseCodes = {
	0:     { message:"Active", valid: true, error: false },
	21000: { message:"App store could not read", valid: false, error: true },
	21002: { message:"Data was malformed", valid: false, error: true },
	21003: { message:"Receipt not authenticated", valid: false, error: true },
	21004: { message:"Shared secret does not match", valid: false, error: true },
	21005: { message:"Receipt server unavailable", valid: false, error: true },
	21006: { message:"Receipt valid but sub expired", valid: false, error: false },	
	21007: { message:"Sandbox receipt sent to Production environment", valid: false, error: true, redirect: true }, 
	21008: { message:"Production receipt sent to Sandbox environment", valid: false, error: true }    
};

// 21007 = special case for app review handling - forward any request that is intended for the Sandbox but was sent to Production, this is what the app review team does

///////////////////////////////////////////////////////
// Private utils
function LOGINFO(s) {
	Logger.info("IOS IAP Validator", s);
}
function LOGDEBUG(s) {
	Logger.debug("IOS IAP Validator", s);
}
function LOGERROR(s) {
	Logger.error("IOS IAP Validator", s, false);
}
function LOGCRITICAL(s) {
	Logger.error("IOS IAP Validator", s, true);
}

///////////////////////////////////////////////////////
IOSIAPValidator = function(isProduction, isDebug)
{
console.log("**************************");
	this.m_Host = (isProduction ? kProductionHost : kSandboxHost);
	this.m_Port = 443;
	this.m_Path = "/verifyReceipt";
	this.m_Method = "POST";

	LOGDEBUG( "constructed");
};


//------------------------------------------------------
// public
IOSIAPValidator.prototype.verifyReceipt = function(inReceipt, callback)
{
	var data = {
		"receipt-data": ""
	};

	this.verifyWithRetry(data, inReceipt, callback);
};


//------------------------------------------------------
// private
IOSIAPValidator.prototype.verifyWithRetry = function(inReceiptData, inReceipt, callback)
{
	var selfObj = this;

	var requestOptions = {
		host: selfObj.m_Host,
		port: selfObj.m_Port,
		path: selfObj.m_Path,
		method: selfObj.m_Method
	};

	selfObj.verify(inReceiptData, inReceipt, requestOptions, function(isValid, msg, data) {

		// on a 21007 error retry the request on the sandbox environment, if we're currently on production
		if(data.status == 21007  && selfObj.m_Host == kProductionHost)
		{
			// retry on sandbox
			LOGINFO("Failed with status 21007.  Retrying on sandbox");

			requestOptions["host"] = kSandboxHost;

			selfObj.verify(inReceiptData, inReceipt, requestOptions, function(isValid, msg, data) {
				LOGDEBUG( "Status:" + data.status);
				callback(isValid, msg, data);
			} );
		}
		else
		{
			callback(isValid, msg, data);
		}
	} );
};

//------------------------------------------------------
// inner/private method to run a verification.  This should be wrapped for retry to delegate between production and sandbox
IOSIAPValidator.prototype.verify = function(inData, inReceipt, inOptions, callback)
{
	LOGDEBUG("verifying");


	inData["receipt-data"] = inReceipt;
	var postData = JSON.stringify(inData);

	LOGDEBUG(postData);

	inOptions.headers = {
		'Content-Type': 'application/x-www-form-urlencoded',
		'Content-Length': postData.length
	};

	var selfObj = this;

	// make the core request
	var request = https.request(inOptions, function(response) {
		LOGDEBUG(util.format("status code: %s", response.statusCode));
		LOGDEBUG(util.format("headers: %s", response.headers));

		var appleResponseArray = [];

		response.on("data", function(data) {
			if(response.statusCode != 200) 
			{
				LOGDEBUG("Error: " + data);
				return(callback(false, "error", null));
			}

			appleResponseArray.push(data);
		} );

		response.on("end", function(){
			var totalData = appleResponseArray.join("");
			LOGDEBUG("end response:\n" + totalData);

			var responseData = JSON.parse(totalData);
			if(!responseData) {
				responseData = {};
			}
			selfObj.processStatus(responseData, callback);
		} );

	} );

	request.write(postData);
	request.end();

	// print some debug logging on errors
	request.on("error", function(e) {
		LOGDEBUG("In app purchase error:" + e);
	} );

};

//------------------------------------------------------
IOSIAPValidator.prototype.processStatus = function(inData, callback)
{
	if(!inData) {
		inData = {
			"status": 666
		};
	}
	
	// be safe about the lookup (inData could be bogus!)

	var response = {};
	try {
		LOGDEBUG("process status: " + inData.status);

		response = kResponseCodes[inData.status];
	}
	catch(e) {
		response = {
			valid: false,
			error: true,
			err_desc: "unknown status code:" + inData.status
		};
	}

	callback(response.valid, response.message, inData);
};


///////////////////////////////////////////////////////
exports.IOSIAPValidator = IOSIAPValidator;
