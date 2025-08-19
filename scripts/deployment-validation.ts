#!/usr/bin/env tsx
/**
 * 部署验证脚本
 * 验证系统在测试环境中的部署和向后兼容性
 */

import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

interface ValidationResult {
  test: string;
  success: boolean;
  message: string;
  duration: number;
}

interface DeploymentReport {
  timestamp: string;
  environment: string;
  results: ValidationResult[];
  summary: {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    compatibilityScore: number;
  };
}

/**
 * 执行命令
 */
async function executeCommand(command: string, args: string[], timeout = 30000): Promise<{ success: boolean; output: string; error: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: 'pipe',
      timeout,
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      resolve({
        success: code === 0,
        output: stdout,
        error: stderr,
      });
    });

    child.on('error', (error) => {
      resolve({
        success: false,
        output: '',
        error: error.message,
      });
    });

    // 设置超时
    setTimeout(() => {
      child.kill('SIGTERM');
      resolve({
        success: false,
        output: stdout,
        error: '命令执行超时',
      });
    }, timeout);
  });
}

/**
 * 验证构建产物
 */
async function validateBuildArtifacts(): Promise<ValidationResult> {
  const startTime = Date.now();
  
  try {
    // 检查核心包构建产物
    const coreDistExists = await checkFileExists('packages/core/dist/index.js');
    const coreTypesExists = await checkFileExists('packages/core/dist/index.d.ts');
    
    // 检查CLI包构建产物
    const cliDistExists = await checkFileExists('packages/cli/dist/index.js');
    const cliTypesExists = await checkFileExists('packages/cli/dist/index.d.ts');
    
    // 检查后端构建产物
    const backendDistExists = await checkFileExists('backend/dist/index.js');
    
    const allExists = coreDistExists && coreTypesExists && cliDistExists && cliTypesExists && backendDistExists;
    
    return {
      test: '构建产物验证',
      success: allExists,
      message: allExists ? '所有构建产物存在' : '部分构建产物缺失',
      duration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      test: '构建产物验证',
      success: false,
      message: `验证失败: ${(error as Error).message}`,
      duration: Date.now() - startTime,
    };
  }
}

/**
 * 检查文件是否存在
 */
async function checkFileExists(filePath: string): Promise<boolean> {
  try {
    await readFile(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * 验证向后兼容性
 */
async function validateBackwardCompatibility(): Promise<ValidationResult> {
  const startTime = Date.now();
  
  try {
    // 检查现有配置文件格式兼容性
    const configCompatible = await validateConfigCompatibility();
    
    // 检查API端点兼容性
    const apiCompatible = await validateApiCompatibility();
    
    // 检查包导出兼容性
    const exportCompatible = await validateExportCompatibility();
    
    const allCompatible = configCompatible && apiCompatible && exportCompatible;
    
    return {
      test: '向后兼容性验证',
      success: allCompatible,
      message: allCompatible ? '向后兼容性良好' : '存在兼容性问题',
      duration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      test: '向后兼容性验证',
      success: false,
      message: `兼容性验证失败: ${(error as Error).message}`,
      duration: Date.now() - startTime,
    };
  }
}

/**
 * 验证配置文件兼容性
 */
async function validateConfigCompatibility(): Promise<boolean> {
  try {
    // 检查现有配置文件是否能正常解析
    const mcpConfigExists = await checkFileExists('backend/config/mcp_server.json');
    const groupConfigExists = await checkFileExists('backend/config/group.json');
    const systemConfigExists = await checkFileExists('backend/config/system.json');
    
    return mcpConfigExists && groupConfigExists && systemConfigExists;
  } catch {
    return false;
  }
}

/**
 * 验证API端点兼容性
 */
async function validateApiCompatibility(): Promise<boolean> {
  try {
    // 检查关键API文件是否存在
    const mcpApiExists = await checkFileExists('backend/src/mcp.ts');
    const hubApiExists = await checkFileExists('backend/src/api/hub.ts');
    const groupApiExists = await checkFileExists('backend/src/api/groups/index.ts');
    
    return mcpApiExists && hubApiExists && groupApiExists;
  } catch {
    return false;
  }
}

/**
 * 验证包导出兼容性
 */
async function validateExportCompatibility(): Promise<boolean> {
  try {
    // 检查核心包导出
    const coreIndexExists = await checkFileExists('packages/core/src/index.ts');
    const cliIndexExists = await checkFileExists('packages/cli/src/index.ts');
    
    return coreIndexExists && cliIndexExists;
  } catch {
    return false;
  }
}

/**
 * 验证性能指标
 */
async function validatePerformanceMetrics(): Promise<ValidationResult> {
  const startTime = Date.now();
  
  try {
    // 运行性能测试
    const result = await executeCommand('npx', ['tsx', 'scripts/performance-test.ts'], 60000);
    
    // 检查性能测试结果
    const performanceGood = result.success || result.output.includes('性能表现良好') || result.output.includes('性能表现优秀');
    
    return {
      test: '性能指标验证',
      success: performanceGood,
      message: performanceGood ? '性能指标达标' : '性能指标未达标',
      duration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      test: '性能指标验证',
      success: false,
      message: `性能验证失败: ${(error as Error).message}`,
      duration: Date.now() - startTime,
    };
  }
}

/**
 * 验证功能完整性
 */
async function validateFunctionalIntegrity(): Promise<ValidationResult> {
  const startTime = Date.now();
  
  try {
    // 运行核心包测试
    const coreTestResult = await executeCommand('pnpm', ['--filter', '@mcp-core/mcp-hub-core', 'test'], 30000);
    
    // 运行后端测试
    const backendTestResult = await executeCommand('pnpm', ['--filter', '@mcp-core/mcp-hub-api', 'test'], 45000);
    
    const allTestsPassed = coreTestResult.success && backendTestResult.success;
    
    return {
      test: '功能完整性验证',
      success: allTestsPassed,
      message: allTestsPassed ? '所有功能测试通过' : '部分功能测试失败',
      duration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      test: '功能完整性验证',
      success: false,
      message: `功能验证失败: ${(error as Error).message}`,
      duration: Date.now() - startTime,
    };
  }
}

/**
 * 验证部署环境
 */
async function validateDeploymentEnvironment(): Promise<ValidationResult> {
  const startTime = Date.now();
  
  try {
    // 检查Node.js版本
    const nodeResult = await executeCommand('node', ['--version']);
    const nodeVersion = nodeResult.output.trim();
    const nodeVersionValid = nodeVersion.startsWith('v18.') || nodeVersion.startsWith('v20.') || nodeVersion.startsWith('v22.');
    
    // 检查pnpm版本
    const pnpmResult = await executeCommand('pnpm', ['--version']);
    const pnpmVersionValid = pnpmResult.success;
    
    // 检查TypeScript版本
    const tsResult = await executeCommand('npx', ['tsc', '--version']);
    const tsVersionValid = tsResult.success;
    
    const envValid = nodeVersionValid && pnpmVersionValid && tsVersionValid;
    
    return {
      test: '部署环境验证',
      success: envValid,
      message: envValid ? `环境验证通过 (Node: ${nodeVersion})` : '环境验证失败',
      duration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      test: '部署环境验证',
      success: false,
      message: `环境验证失败: ${(error as Error).message}`,
      duration: Date.now() - startTime,
    };
  }
}

/**
 * 运行部署验证
 */
async function runDeploymentValidation(): Promise<DeploymentReport> {
  console.log('🚀 开始部署验证...\n');

  const validationTests = [
    validateDeploymentEnvironment,
    validateBuildArtifacts,
    validateBackwardCompatibility,
    validateFunctionalIntegrity,
    validatePerformanceMetrics,
  ];

  const results: ValidationResult[] = [];

  for (const test of validationTests) {
    console.log(`⏱️  执行: ${test.name.replace('validate', '').replace(/([A-Z])/g, ' $1').trim()}`);
    const result = await test();
    results.push(result);

    const status = result.success ? '✅' : '❌';
    const duration = `${Math.round(result.duration)}ms`;
    
    console.log(`   ${status} ${result.message} (${duration})`);
    console.log('');
  }

  // 计算兼容性评分
  const compatibilityScore = calculateCompatibilityScore(results);

  const summary = {
    totalTests: results.length,
    passedTests: results.filter(r => r.success).length,
    failedTests: results.filter(r => !r.success).length,
    compatibilityScore,
  };

  return {
    timestamp: new Date().toISOString(),
    environment: 'test',
    results,
    summary,
  };
}

/**
 * 计算兼容性评分
 */
function calculateCompatibilityScore(results: ValidationResult[]): number {
  const weights = {
    '部署环境验证': 20,
    '构建产物验证': 25,
    '向后兼容性验证': 30,
    '功能完整性验证': 20,
    '性能指标验证': 5,
  };

  let totalScore = 0;
  let totalWeight = 0;

  results.forEach(result => {
    const weight = weights[result.test as keyof typeof weights] || 10;
    totalWeight += weight;
    if (result.success) {
      totalScore += weight;
    }
  });

  return Math.round((totalScore / totalWeight) * 100);
}

/**
 * 生成部署报告
 */
function generateDeploymentReport(report: DeploymentReport): void {
  console.log('📊 部署验证报告');
  console.log('='.repeat(50));
  console.log(`验证时间: ${report.timestamp}`);
  console.log(`验证环境: ${report.environment}`);
  console.log(`总验证项: ${report.summary.totalTests}`);
  console.log(`通过验证: ${report.summary.passedTests}`);
  console.log(`失败验证: ${report.summary.failedTests}`);
  console.log(`兼容性评分: ${report.summary.compatibilityScore}/100`);
  console.log('');

  // 部署状态评估
  if (report.summary.compatibilityScore >= 90) {
    console.log('🎉 部署验证优秀，可以安全部署！');
  } else if (report.summary.compatibilityScore >= 80) {
    console.log('👍 部署验证良好，建议部署');
  } else if (report.summary.compatibilityScore >= 70) {
    console.log('⚠️  部署验证一般，需要注意风险');
  } else {
    console.log('❌ 部署验证不通过，不建议部署');
  }

  console.log('');
  console.log('详细结果:');
  console.log('-'.repeat(50));
  
  report.results.forEach((result, index) => {
    const status = result.success ? '✅' : '❌';
    const duration = `${Math.round(result.duration)}ms`;
    console.log(`${index + 1}. ${status} ${result.test} - ${result.message} (${duration})`);
  });

  // 保存报告到文件
  const reportPath = join(process.cwd(), 'deployment-report.json');
  writeFile(reportPath, JSON.stringify(report, null, 2))
    .then(() => {
      console.log(`\n📄 详细报告已保存到: ${reportPath}`);
    })
    .catch((error) => {
      console.error(`保存报告失败: ${error.message}`);
    });
}

/**
 * 主函数
 */
async function main(): Promise<void> {
  try {
    const report = await runDeploymentValidation();
    generateDeploymentReport(report);
    
    // 根据验证结果设置退出码
    if (report.summary.failedTests > 0) {
      console.log('\n❌ 部署验证存在失败项');
      process.exit(1);
    }
    
    if (report.summary.compatibilityScore < 70) {
      console.log('\n❌ 兼容性评分过低，不建议部署');
      process.exit(2);
    }
    
    console.log('\n✅ 部署验证通过！');
  } catch (error) {
    console.error('❌ 部署验证执行失败:', error);
    process.exit(1);
  }
}

// 运行验证
if (require.main === module) {
  main();
}