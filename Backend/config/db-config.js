const oracledb = require('oracledb');
require('dotenv').config();

const dbConfig = {
    connectString: process.env.ORACLE_CONNECT_STRING
};

module.exports = { oracledb, dbConfig };