#!/usr/bin/env tsx

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

interface CoverageSummary {
  total: {
    branches: { pct: number };
    functions: { pct: number };
    lines: { pct: number };
    statements: { pct: number };
  };
}

interface PackageInfo {
  name: string;
  path: string;
  displayName: string;
}

const packages: PackageInfo[] = [
  {
    name: 'backend',
    path: './backend',
    displayName: 'Backend API',
  },
  {
    name: 'core',
    path: './packages/core',
    displayName: 'Core Package',
  },
  {
    name: 'cli',
    path: './packages/cli',
    displayName: 'CLI Package',
  },
];

function displayPackageCoverage(pkg: PackageInfo): CoverageSummary | null {
  const coverageFile = join(pkg.path, 'coverage', 'coverage-summary.json');

  if (!existsSync(coverageFile)) {
    console.log(`⚠️  ${pkg.displayName}: 覆盖率报告不存在`);
    console.log(`   请先运行: pnpm --filter "*${pkg.name}*" test:coverage`);
    return null;
  }

  try {
    const coverage: CoverageSummary = JSON.parse(
      readFileSync(coverageFile, 'utf-8'),
    );
    const { total } = coverage;

    console.log(`\n📊 ${pkg.displayName} 覆盖率报告:`);
    console.log(`   分支覆盖率: ${total.branches.pct.toFixed(2)}%`);
    console.log(`   函数覆盖率: ${total.functions.pct.toFixed(2)}%`);
    console.log(`   行覆盖率: ${total.lines.pct.toFixed(2)}%`);
    console.log(`   语句覆盖率: ${total.statements.pct.toFixed(2)}%`);

    return coverage;
  } catch (error) {
    console.error(`❌ ${pkg.displayName}: 解析覆盖率文件失败:`, error);
    return null;
  }
}

function main() {
  console.log('📈 项目测试覆盖率报告\n');
  console.log('='.repeat(50));

  const coverageData: CoverageSummary[] = [];

  for (const pkg of packages) {
    const coverage = displayPackageCoverage(pkg);
    if (coverage) {
      coverageData.push(coverage);
    }
  }

  if (coverageData.length > 0) {
    // 计算总体覆盖率（简单平均）
    const totalBranches =
      coverageData.reduce((sum, c) => sum + c.total.branches.pct, 0) /
      coverageData.length;
    const totalFunctions =
      coverageData.reduce((sum, c) => sum + c.total.functions.pct, 0) /
      coverageData.length;
    const totalLines =
      coverageData.reduce((sum, c) => sum + c.total.lines.pct, 0) /
      coverageData.length;
    const totalStatements =
      coverageData.reduce((sum, c) => sum + c.total.statements.pct, 0) /
      coverageData.length;

    console.log('\n' + '='.repeat(50));
    console.log('🎯 项目总体覆盖率 (平均值):');
    console.log(`   分支覆盖率: ${totalBranches.toFixed(2)}%`);
    console.log(`   函数覆盖率: ${totalFunctions.toFixed(2)}%`);
    console.log(`   行覆盖率: ${totalLines.toFixed(2)}%`);
    console.log(`   语句覆盖率: ${totalStatements.toFixed(2)}%`);
  }

  console.log('\n💡 提示:');
  console.log('   - Vitest 会自动检查每个包的覆盖率阈值');
  console.log('   - 如果覆盖率不达标，测试会失败');
  console.log('   - 查看详细报告: 打开各包的 coverage/index.html');
  console.log('   - 调试模式: 使用 VITEST_DEBUG=true 查看详细日志');

  console.log('\n✅ 覆盖率报告生成完成!');
}

if (require.main === module) {
  main();
}
