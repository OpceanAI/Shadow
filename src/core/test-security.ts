export interface SecurityTest {
  name: string;
  category: string;
  payload: string;
  expected: string;
  description: string;
}

export interface SecurityTestResult {
  test: SecurityTest;
  passed: boolean;
  actual: string;
  error?: string;
}

export class SecurityTestGenerator {
  generateSQLInjectionTests(): SecurityTest[] {
    return [
      {
        name: 'sqli_basic_or',
        category: 'SQL Injection',
        payload: "' OR '1'='1",
        expected: 'input should be sanitized',
        description: 'Basic OR-based SQL injection',
      },
      {
        name: 'sqli_or_always_true',
        category: 'SQL Injection',
        payload: "' OR 1=1 --",
        expected: 'input should be sanitized',
        description: 'OR 1=1 always true injection',
      },
      {
        name: 'sqli_comment_bypass',
        category: 'SQL Injection',
        payload: "admin'--",
        expected: 'input should be sanitized',
        description: 'Comment-based auth bypass',
      },
      {
        name: 'sqli_drop_table',
        category: 'SQL Injection',
        payload: "1; DROP TABLE users; --",
        expected: 'input should be sanitized',
        description: 'DROP TABLE injection attempt',
      },
      {
        name: 'sqli_union_select',
        category: 'SQL Injection',
        payload: "' UNION SELECT * FROM users --",
        expected: 'input should be sanitized',
        description: 'Union-based injection',
      },
      {
        name: 'sqli_semicolon',
        category: 'SQL Injection',
        payload: "'; EXECUTE IMMEDIATE 'malicious'; --",
        expected: 'input should be sanitized',
        description: 'Semicolon-based injection',
      },
      {
        name: 'sqli_double_quote',
        category: 'SQL Injection',
        payload: '" OR ""="',
        expected: 'input should be sanitized',
        description: 'Double-quote injection',
      },
      {
        name: 'sqli_sleep',
        category: 'SQL Injection',
        payload: "'; SELECT SLEEP(5); --",
        expected: 'input should be sanitized',
        description: 'Time-based blind injection',
      },
      {
        name: 'sqli_hex_encode',
        category: 'SQL Injection',
        payload: "0x27204f5220313d31",
        expected: 'input should be sanitized',
        description: 'Hex-encoded injection',
      },
      {
        name: 'sqli_wide_char',
        category: 'SQL Injection',
        payload: "' OR 1=1 %00",
        expected: 'input should be sanitized',
        description: 'Null-byte wide char injection',
      },
    ];
  }

  generateXSSTests(): SecurityTest[] {
    return [
      {
        name: 'xss_basic_script',
        category: 'Cross-Site Scripting (XSS)',
        payload: '<script>alert(1)</script>',
        expected: 'input should be sanitized',
        description: 'Basic script tag injection',
      },
      {
        name: 'xss_img_onerror',
        category: 'Cross-Site Scripting (XSS)',
        payload: '<img src=x onerror=alert(1)>',
        expected: 'input should be sanitized',
        description: 'Image onerror event handler',
      },
      {
        name: 'xss_svg_onload',
        category: 'Cross-Site Scripting (XSS)',
        payload: '<svg onload=alert(1)>',
        expected: 'input should be sanitized',
        description: 'SVG onload event handler',
      },
      {
        name: 'xss_body_onload',
        category: 'Cross-Site Scripting (XSS)',
        payload: '<body onload=alert(1)>',
        expected: 'input should be sanitized',
        description: 'Body onload event handler',
      },
      {
        name: 'xss_iframe',
        category: 'Cross-Site Scripting (XSS)',
        payload: '<iframe src="javascript:alert(1)">',
        expected: 'input should be sanitized',
        description: 'Iframe with javascript URI',
      },
      {
        name: 'xss_a_href',
        category: 'Cross-Site Scripting (XSS)',
        payload: '<a href="javascript:alert(1)">click</a>',
        expected: 'input should be sanitized',
        description: 'Anchor with javascript URI',
      },
      {
        name: 'xss_encoded',
        category: 'Cross-Site Scripting (XSS)',
        payload: '&#60;script&#62;alert(1)&#60;/script&#62;',
        expected: 'input should be sanitized',
        description: 'HTML entity encoded XSS',
      },
      {
        name: 'xss_case_variant',
        category: 'Cross-Site Scripting (XSS)',
        payload: '<ScRiPt>alert(1)</ScRiPt>',
        expected: 'input should be sanitized',
        description: 'Mixed-case script tag',
      },
      {
        name: 'xss_double_encode',
        category: 'Cross-Site Scripting (XSS)',
        payload: '%253Cscript%253Ealert(1)%253C/script%253E',
        expected: 'input should be sanitized',
        description: 'Double URL-encoded XSS',
      },
      {
        name: 'xss_eval',
        category: 'Cross-Site Scripting (XSS)',
        payload: '";eval(alert(1));//',
        expected: 'input should be sanitized',
        description: 'Eval-based injection in JS context',
      },
    ];
  }

  generatePathTraversalTests(): SecurityTest[] {
    return [
      {
        name: 'path_traversal_basic',
        category: 'Path Traversal',
        payload: '../../../etc/passwd',
        expected: 'input should be sanitized',
        description: 'Basic ../ traversal to /etc/passwd',
      },
      {
        name: 'path_traversal_root',
        category: 'Path Traversal',
        payload: '/etc/passwd',
        expected: 'input should be sanitized',
        description: 'Absolute path access attempt',
      },
      {
        name: 'path_traversal_encoded',
        category: 'Path Traversal',
        payload: '%2e%2e%2f%2e%2e%2fetc%2fpasswd',
        expected: 'input should be sanitized',
        description: 'URL-encoded path traversal',
      },
      {
        name: 'path_traversal_double_encode',
        category: 'Path Traversal',
        payload: '%252e%252e%252fetc%252fpasswd',
        expected: 'input should be sanitized',
        description: 'Double URL-encoded path traversal',
      },
      {
        name: 'path_traversal_null_byte',
        category: 'Path Traversal',
        payload: '../../../etc/passwd%00.jpg',
        expected: 'input should be sanitized',
        description: 'Null byte extension bypass',
      },
      {
        name: 'path_traversal_dots',
        category: 'Path Traversal',
        payload: '....//....//etc/passwd',
        expected: 'input should be sanitized',
        description: 'Alternative dot-slash traversal',
      },
      {
        name: 'path_traversal_backslash',
        category: 'Path Traversal',
        payload: '..\\..\\..\\windows\\system32',
        expected: 'input should be sanitized',
        description: 'Backslash path traversal',
      },
      {
        name: 'path_traversal_unicode',
        category: 'Path Traversal',
        payload: '..%c0%af..%c0%afetc/passwd',
        expected: 'input should be sanitized',
        description: 'Unicode-based traversal',
      },
    ];
  }

  generateAuthBypassTests(): SecurityTest[] {
    return [
      {
        name: 'auth_nosql_injection',
        category: 'Auth Bypass',
        payload: JSON.stringify({ username: { $ne: '' }, password: { $ne: '' } }),
        expected: 'input should be sanitized',
        description: 'NoSQL injection for auth bypass',
      },
      {
        name: 'auth_empty_credentials',
        category: 'Auth Bypass',
        payload: JSON.stringify({ username: '', password: '' }),
        expected: 'access should be denied',
        description: 'Empty credentials attempt',
      },
      {
        name: 'auth_null_credentials',
        category: 'Auth Bypass',
        payload: JSON.stringify({ username: null, password: null }),
        expected: 'access should be denied',
        description: 'Null credentials attempt',
      },
      {
        name: 'auth_jwt_none_alg',
        category: 'Auth Bypass',
        payload: 'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJhZG1pbiI6dHJ1ZX0.',
        expected: 'token should be rejected',
        description: 'JWT with none algorithm',
      },
      {
        name: 'auth_role_manipulation',
        category: 'Auth Bypass',
        payload: JSON.stringify({ username: 'user', role: 'admin' }),
        expected: 'role should not be assignable',
        description: 'Role parameter manipulation',
      },
      {
        name: 'auth_forged_token',
        category: 'Auth Bypass',
        payload: 'Bearer invalid_token',
        expected: 'token should be rejected',
        description: 'Invalid/forged auth token',
      },
      {
        name: 'auth_basic_empty',
        category: 'Auth Bypass',
        payload: 'Basic ',
        expected: 'auth should be rejected',
        description: 'Empty Basic auth credentials',
      },
    ];
  }

  generateAllTests(): SecurityTest[] {
    return [
      ...this.generateSQLInjectionTests(),
      ...this.generateXSSTests(),
      ...this.generatePathTraversalTests(),
      ...this.generateAuthBypassTests(),
    ];
  }

  getTestsByCategory(category: string): SecurityTest[] {
    return this.generateAllTests().filter((t) => t.category === category);
  }

  getCategories(): string[] {
    return ['SQL Injection', 'Cross-Site Scripting (XSS)', 'Path Traversal', 'Auth Bypass'];
  }

  testSanitizer(sanitize: (input: string) => string): SecurityTestResult[] {
    const tests = this.generateAllTests();
    const results: SecurityTestResult[] = [];

    for (const test of tests) {
      try {
        const sanitized = sanitize(test.payload);
        const passed =
          sanitized !== test.payload &&
          !sanitized.includes('<script') &&
          !sanitized.includes('OR 1=1');

        results.push({
          test,
          passed,
          actual: sanitized.slice(0, 100),
        });
      } catch (err) {
        results.push({
          test,
          passed: false,
          actual: '',
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return results;
  }

  generateTestCode(framework: 'jest' | 'vitest' | 'pytest' = 'jest'): string {
    const tests = this.generateAllTests();
    const lines: string[] = [];

    if (framework === 'pytest') {
      lines.push('import pytest');
      lines.push('');
      for (const t of tests) {
        lines.push(`def test_${t.name}():`);
        lines.push(`    """${t.description}"""`);
        lines.push(`    payload = ${JSON.stringify(t.payload)}`);
        lines.push(`    # Verify input is sanitized`);
        lines.push(`    # result = handle_input(payload)`);
        lines.push(`    # assert payload not in result`);
        lines.push('');
      }
    } else {
      lines.push(`describe('Security Tests', () => {`);
      for (const t of tests) {
        lines.push(`  test('${t.name}: ${t.description}', () => {`);
        lines.push(`    const payload = ${JSON.stringify(t.payload)};`);
        lines.push(`    // expect(sanitize(payload)).not.toBe(payload);`);
        lines.push(`  });`);
        lines.push('');
      }
      lines.push('});');
    }

    return lines.join('\n');
  }
}
