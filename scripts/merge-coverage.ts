#!/usr/bin/env tsx

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

interface CoverageData {
  [filePath: string]: {
    path: string;
    statementMap: Record<string, unknown>;
    fnMap: Record<string, unknown>;
    branchMap: Record<string, unknown>;
    s: Record<string, number>;
    f: Record<string, number>;
    b: Record<string, number>;
  };
}

interface CoverageSummary {
  total: {
    lines: { total: number; covered: number; skipped: number; pct: number };
    functions: { total: number; covered: number; skipped: number; pct: number };
    statements: {
      total: number;
      covered: number;
      skipped: number;
      pct: number;
    };
    branches: { total: number; covered: number; skipped: number; pct: number };
  };
}

const packages = [
  { name: 'backend', path: './backend' },
  { name: 'core', path: './packages/core' },
  { name: 'cli', path: './packages/cli' },
];

function mergeCoverageData(): { data: CoverageData; summary: CoverageSummary } {
  const mergedData: CoverageData = {};
  const summaryData = {
    lines: { total: 0, covered: 0, skipped: 0, pct: 0 },
    functions: { total: 0, covered: 0, skipped: 0, pct: 0 },
    statements: { total: 0, covered: 0, skipped: 0, pct: 0 },
    branches: { total: 0, covered: 0, skipped: 0, pct: 0 },
  };

  for (const pkg of packages) {
    const coverageFile = join(pkg.path, 'coverage', 'coverage-final.json');
    const summaryFile = join(pkg.path, 'coverage', 'coverage-summary.json');

    if (existsSync(coverageFile)) {
      try {
        const data: CoverageData = JSON.parse(readFileSync(coverageFile, 'utf-8'));

        // 合并覆盖率数据，添加包前缀避免冲突
        for (const [filePath, fileData] of Object.entries(data)) {
          const prefixedPath = `${pkg.name}/${filePath}`;
          mergedData[prefixedPath] = {
            ...fileData,
            path: prefixedPath,
          };
        }

        console.log(`✅ 已合并 ${pkg.name} 包的覆盖率数据`);
      } catch (error) {
        console.warn(`⚠️  无法读取 ${pkg.name} 包的覆盖率数据:`, error);
      }
    } else {
      console.warn(`⚠️  ${pkg.name} 包的覆盖率文件不存在: ${coverageFile}`);
    }

    // 合并汇总数据
    if (existsSync(summaryFile)) {
      try {
        const summary: CoverageSummary = JSON.parse(readFileSync(summaryFile, 'utf-8'));
        const { total } = summary;

        summaryData.lines.total += total.lines.total;
        summaryData.lines.covered += total.lines.covered;
        summaryData.lines.skipped += total.lines.skipped;

        summaryData.functions.total += total.functions.total;
        summaryData.functions.covered += total.functions.covered;
        summaryData.functions.skipped += total.functions.skipped;

        summaryData.statements.total += total.statements.total;
        summaryData.statements.covered += total.statements.covered;
        summaryData.statements.skipped += total.statements.skipped;

        summaryData.branches.total += total.branches.total;
        summaryData.branches.covered += total.branches.covered;
        summaryData.branches.skipped += total.branches.skipped;
      } catch (error) {
        console.warn(`⚠️  无法读取 ${pkg.name} 包的汇总数据:`, error);
      }
    }
  }

  // 计算总体百分比
  summaryData.lines.pct =
    summaryData.lines.total > 0 ? (summaryData.lines.covered / summaryData.lines.total) * 100 : 0;
  summaryData.functions.pct =
    summaryData.functions.total > 0
      ? (summaryData.functions.covered / summaryData.functions.total) * 100
      : 0;
  summaryData.statements.pct =
    summaryData.statements.total > 0
      ? (summaryData.statements.covered / summaryData.statements.total) * 100
      : 0;
  summaryData.branches.pct =
    summaryData.branches.total > 0
      ? (summaryData.branches.covered / summaryData.branches.total) * 100
      : 0;

  const mergedSummary: CoverageSummary = {
    total: summaryData,
  };

  return { data: mergedData, summary: mergedSummary };
}

function main() {
  console.log('🔄 合并所有包的覆盖率报告...\n');

  // 确保输出目录存在
  const outputDir = './coverage';
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const { data, summary } = mergeCoverageData();

  // 写入合并后的覆盖率数据
  const mergedDataFile = join(outputDir, 'coverage-final.json');
  writeFileSync(mergedDataFile, JSON.stringify(data, null, 2));
  console.log(`📄 已生成合并的覆盖率数据: ${mergedDataFile}`);

  // 写入合并后的汇总数据
  const mergedSummaryFile = join(outputDir, 'coverage-summary.json');
  writeFileSync(mergedSummaryFile, JSON.stringify(summary, null, 2));
  console.log(`📊 已生成合并的汇总报告: ${mergedSummaryFile}`);

  // 显示总体覆盖率
  console.log('\n📈 项目总体覆盖率:');
  console.log(
    `  行覆盖率: ${summary.total.lines.pct.toFixed(2)}% (${summary.total.lines.covered}/${summary.total.lines.total})`,
  );
  console.log(
    `  函数覆盖率: ${summary.total.functions.pct.toFixed(2)}% (${summary.total.functions.covered}/${summary.total.functions.total})`,
  );
  console.log(
    `  语句覆盖率: ${summary.total.statements.pct.toFixed(2)}% (${summary.total.statements.covered}/${summary.total.statements.total})`,
  );
  console.log(
    `  分支覆盖率: ${summary.total.branches.pct.toFixed(2)}% (${summary.total.branches.covered}/${summary.total.branches.total})`,
  );

  console.log('\n✅ 覆盖率报告合并完成!');
}

if (require.main === module) {
  main();
}
