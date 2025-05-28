const fs = require('fs');
const path = require('path');

module.exports = (results) => {
  // Process test results and generate custom reports
  const summary = {
    timestamp: new Date().toISOString(),
    totalTests: results.numTotalTests,
    passedTests: results.numPassedTests,
    failedTests: results.numFailedTests,
    skippedTests: results.numPendingTests,
    testSuites: results.numTotalTestSuites,
    passedTestSuites: results.numPassedTestSuites,
    failedTestSuites: results.numFailedTestSuites,
    coverage: results.coverageMap ? extractCoverageData(results.coverageMap) : null,
    duration: results.testResults.reduce((total, suite) => total + (suite.perfStats?.end - suite.perfStats?.start || 0), 0),
    success: results.success
  };

  // Generate detailed test report
  const detailedReport = {
    summary,
    testSuites: results.testResults.map(suite => ({
      name: suite.testFilePath.replace(process.cwd(), ''),
      status: suite.numFailingTests > 0 ? 'failed' : 'passed',
      duration: suite.perfStats?.end - suite.perfStats?.start || 0,
      tests: suite.testResults.map(test => ({
        name: test.fullName,
        status: test.status,
        duration: test.duration || 0,
        error: test.failureMessages.length > 0 ? test.failureMessages[0] : null
      }))
    }))
  };

  // Write summary to file
  try {
    fs.mkdirSync('coverage', { recursive: true });
    fs.writeFileSync(
      path.join('coverage', 'test-summary.json'),
      JSON.stringify(summary, null, 2)
    );
    
    fs.writeFileSync(
      path.join('coverage', 'test-detailed.json'),
      JSON.stringify(detailedReport, null, 2)
    );
  } catch (error) {
    console.warn('Could not write test results:', error.message);
  }

  // Log summary to console
  console.log('\n📊 Test Results Summary:');
  console.log(`   Total Tests: ${summary.totalTests}`);
  console.log(`   Passed: ${summary.passedTests} ✅`);
  console.log(`   Failed: ${summary.failedTests} ❌`);
  console.log(`   Skipped: ${summary.skippedTests} ⏭️`);
  console.log(`   Duration: ${(summary.duration / 1000).toFixed(2)}s`);
  
  if (summary.coverage) {
    console.log('\n📈 Coverage Summary:');
    console.log(`   Lines: ${summary.coverage.lines.pct}%`);
    console.log(`   Functions: ${summary.coverage.functions.pct}%`);
    console.log(`   Branches: ${summary.coverage.branches.pct}%`);
    console.log(`   Statements: ${summary.coverage.statements.pct}%`);
  }

  // Generate badges for README
  generateBadges(summary);

  return results;
};

function extractCoverageData(coverageMap) {
  if (!coverageMap || typeof coverageMap.getCoverageSummary !== 'function') {
    return null;
  }

  const summary = coverageMap.getCoverageSummary();
  return {
    lines: {
      total: summary.lines.total,
      covered: summary.lines.covered,
      pct: summary.lines.pct
    },
    functions: {
      total: summary.functions.total,
      covered: summary.functions.covered,
      pct: summary.functions.pct
    },
    branches: {
      total: summary.branches.total,
      covered: summary.branches.covered,
      pct: summary.branches.pct
    },
    statements: {
      total: summary.statements.total,
      covered: summary.statements.covered,
      pct: summary.statements.pct
    }
  };
}

function generateBadges(summary) {
  const badges = {
    tests: {
      label: 'tests',
      message: `${summary.passedTests}/${summary.totalTests} passing`,
      color: summary.failedTests === 0 ? 'brightgreen' : 'red'
    },
    coverage: summary.coverage ? {
      label: 'coverage',
      message: `${summary.coverage.lines.pct}%`,
      color: getCoverageColor(summary.coverage.lines.pct)
    } : null
  };

  try {
    fs.writeFileSync(
      path.join('coverage', 'badges.json'),
      JSON.stringify(badges, null, 2)
    );
  } catch (error) {
    console.warn('Could not write badges:', error.message);
  }
}

function getCoverageColor(percentage) {
  if (percentage >= 90) return 'brightgreen';
  if (percentage >= 80) return 'green';
  if (percentage >= 70) return 'yellow';
  if (percentage >= 60) return 'orange';
  return 'red';
}