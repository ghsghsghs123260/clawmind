/**
 * Skill Matcher
 * 匹配用户输入与 Skill 触发条件
 */

/**
 * 计算两个字符串的相似度（Levenshtein 距离）
 * @param {string} str1 - 字符串1
 * @param {string} str2 - 字符串2
 * @returns {number} 相似度 (0-1)
 */
function calculateSimilarity(str1, str2) {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();

  const len1 = s1.length;
  const len2 = s2.length;

  if (len1 === 0) return len2 === 0 ? 1 : 0;
  if (len2 === 0) return 0;

  const matrix = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(0));

  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  const distance = matrix[len1][len2];
  const maxLen = Math.max(len1, len2);
  return 1 - distance / maxLen;
}

/**
 * 关键词匹配
 * @param {string} input - 用户输入
 * @param {string[]} keywords - 关键词列表
 * @returns {Object} { matched: boolean, score: number, matchedKeywords: string[] }
 */
function matchKeywords(input, keywords) {
  const inputLower = input.toLowerCase();
  const matchedKeywords = [];
  let totalScore = 0;

  for (const keyword of keywords) {
    const keywordLower = keyword.toLowerCase();

    // 精确匹配
    if (inputLower.includes(keywordLower)) {
      matchedKeywords.push(keyword);
      totalScore += 1.0;
    } else {
      // 模糊匹配
      const similarity = calculateSimilarity(inputLower, keywordLower);
      if (similarity > 0.7) {
        matchedKeywords.push(keyword);
        totalScore += similarity;
      }
    }
  }

  return {
    matched: matchedKeywords.length > 0,
    // 基础分：匹配到就给 0.4，每个额外匹配的关键词 +0.2，上限 1.0
    score: matchedKeywords.length > 0 ? Math.min(1, 0.4 + (matchedKeywords.length - 1) * 0.2) : 0,
    matchedKeywords,
  };
}

/**
 * 正则表达式匹配
 * 支持 {paramName} 语法自动转换为命名捕获组
 * @param {string} input - 用户输入
 * @param {string[]} patterns - 正则表达式模式列表
 * @returns {Object} { matched: boolean, score: number, matchedPatterns: string[], captures: Object }
 */
function matchPatterns(input, patterns) {
  const matchedPatterns = [];
  const captures = {};
  let totalScore = 0;

  for (const pattern of patterns) {
    try {
      // 将 {paramName} 转换为正则命名捕获组
      // 策略：非贪婪匹配 (.+?) 但最后一个是贪婪的 (.+)
      let paramIndex = 0;
      const totalParams = (pattern.match(/\{\w+\}/g) || []).length;
      const processedPattern = pattern.replace(/\{(\w+)\}/g, (match, name) => {
        paramIndex++;
        // 最后一个参数用贪婪匹配，其余用非贪婪
        return paramIndex === totalParams
          ? `(?<${name}>.+)`
          : `(?<${name}>.+?)`;
      });
      const regex = new RegExp(processedPattern, 'i');
      const match = input.match(regex);

      if (match) {
        matchedPatterns.push(pattern);
        totalScore += 1.0;

        // 提取捕获组（包括命名捕获组和普通捕获组）
        if (match.groups) {
          Object.assign(captures, match.groups);
        }
        // 同时提取普通捕获组（$1, $2, ...）
        for (let i = 1; i < match.length; i++) {
          if (match[i] !== undefined) {
            captures[`$${i}`] = match[i];
          }
        }
      }
    } catch (error) {
      console.warn(`Invalid regex pattern: ${pattern}`, error.message);
    }
  }

  return {
    matched: matchedPatterns.length > 0,
    score: patterns.length > 0 ? totalScore / patterns.length : 0,
    matchedPatterns,
    captures,
  };
}

/**
 * 匹配单个 Skill
 * @param {string} input - 用户输入
 * @param {Object} skill - Skill 对象
 * @returns {Object} { matched: boolean, score: number, details: Object }
 */
function matchSkill(input, skill) {
  const keywordResult = matchKeywords(input, skill.trigger.keywords || []);
  const patternResult = matchPatterns(input, skill.trigger.patterns || []);

  // 综合评分
  const keywordWeight = 0.6;
  const patternWeight = 0.4;
  const totalScore = keywordResult.score * keywordWeight + patternResult.score * patternWeight;

  const matched = keywordResult.matched || patternResult.matched;

  return {
    matched,
    score: totalScore,
    details: {
      keywords: keywordResult,
      patterns: patternResult,
    },
  };
}

/**
 * 从多个 Skills 中找到最佳匹配
 * @param {string} input - 用户输入
 * @param {Object[]} skills - Skill 对象数组
 * @param {number} threshold - 最低匹配分数阈值 (0-1)
 * @returns {Object|null} { skill: Object, matchResult: Object } 或 null
 */
function findBestMatch(input, skills, threshold = 0.3) {
  let bestMatch = null;
  let bestScore = threshold;

  for (const skill of skills) {
    const matchResult = matchSkill(input, skill);

    if (matchResult.matched && matchResult.score > bestScore) {
      bestScore = matchResult.score;
      bestMatch = {
        skill,
        matchResult,
      };
    }
  }

  return bestMatch;
}

/**
 * 从多个 Skills 中找到所有匹配
 * @param {string} input - 用户输入
 * @param {Object[]} skills - Skill 对象数组
 * @param {number} threshold - 最低匹配分数阈值 (0-1)
 * @returns {Object[]} 匹配结果数组，按分数降序排列
 */
function findAllMatches(input, skills, threshold = 0.3) {
  const matches = [];

  for (const skill of skills) {
    const matchResult = matchSkill(input, skill);

    if (matchResult.matched && matchResult.score >= threshold) {
      matches.push({
        skill,
        matchResult,
      });
    }
  }

  // 按分数降序排序
  matches.sort((a, b) => b.matchResult.score - a.matchResult.score);

  return matches;
}

/**
 * 提取参数值
 * 策略优先级：captures > keyword extraction > default
 * @param {string} input - 用户输入
 * @param {Object[]} parameters - 参数定义数组
 * @param {Object} captures - 正则捕获组
 * @returns {Object} 参数值对象
 */
function extractParameters(input, parameters, captures = {}) {
  const extractedParams = {};

  if (!parameters) return extractedParams;

  for (const param of parameters) {
    // 策略 1：从正则捕获组提取
    if (captures[param.name] !== undefined) {
      extractedParams[param.name] = captures[param.name];
      continue;
    }

    // 策略 2：从输入中按关键词提取（paramName:value 或 paramName value）
    const kwPattern = new RegExp(`${param.name}[:\\s]+([^\\s,]+)`, 'i');
    const kwMatch = input.match(kwPattern);
    if (kwMatch) {
      extractedParams[param.name] = kwMatch[1];
      continue;
    }

    // 策略 3：对 URL 类型参数，尝试从输入中提取 URL
    if (param.name === 'url' || param.name === 'source' || param.name === 'output_path') {
      const urlMatch = input.match(/(https?:\/\/[^\s]+|[A-Za-z]:[\\\/][^\s]*)/i);
      if (urlMatch) {
        extractedParams[param.name] = urlMatch[1];
        continue;
      }
    }

    // 策略 4：使用默认值
    if ('default' in param) {
      extractedParams[param.name] = param.default;
    }
  }

  return extractedParams;
}

module.exports = {
  calculateSimilarity,
  matchKeywords,
  matchPatterns,
  matchSkill,
  findBestMatch,
  findAllMatches,
  extractParameters,
};
