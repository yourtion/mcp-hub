#!/usr/bin/env node

/**
 * MCP Hub CLI 可执行文件入口点
 */

const path = require('path')

// 导入编译后的主入口文件
require(path.join(__dirname, '..', 'dist', 'cli.js'))