use anyhow::{Context, Result};
use std::collections::HashMap;
use std::fs;
use std::path::Path;

pub struct EnvFileParser;

impl EnvFileParser {
    pub fn parse_file(path: &Path) -> Result<HashMap<String, String>> {
        let content = fs::read_to_string(path)
            .with_context(|| format!("Failed to read file: {}", path.display()))?;
        
        Self::parse_content(&content)
    }
    
    pub fn parse_content(content: &str) -> Result<HashMap<String, String>> {
        let mut vars = HashMap::new();
        
        for line in content.lines() {
            let line = line.trim();
            
            // Skip empty lines and comments
            if line.is_empty() || line.starts_with('#') {
                continue;
            }
            
            // Find the first = that's not escaped
            if let Some(eq_pos) = Self::find_unescaped_equals(line) {
                let key = line[..eq_pos].trim();
                let value = line[eq_pos + 1..].trim();
                
                // Skip if key is empty
                if key.is_empty() {
                    continue;
                }
                
                // Remove surrounding quotes if present
                let value = Self::unquote_value(value);
                
                vars.insert(key.to_string(), value);
            }
        }
        
        Ok(vars)
    }
    
    fn find_unescaped_equals(s: &str) -> Option<usize> {
        let chars: Vec<char> = s.chars().collect();
        let mut escaped = false;
        
        for (i, &ch) in chars.iter().enumerate() {
            if escaped {
                escaped = false;
                continue;
            }
            
            if ch == '\\' {
                escaped = true;
            } else if ch == '=' {
                return Some(i);
            }
        }
        
        None
    }
    
    fn unquote_value(value: &str) -> String {
        let value = value.trim();
        
        // Check for matching quotes
        if (value.starts_with('"') && value.ends_with('"')) ||
           (value.starts_with('\'') && value.ends_with('\'')) {
            // Remove quotes and unescape
            let inner = &value[1..value.len() - 1];
            Self::unescape_value(inner)
        } else {
            value.to_string()
        }
    }
    
    fn unescape_value(s: &str) -> String {
        let mut result = String::new();
        let mut chars = s.chars();
        
        while let Some(ch) = chars.next() {
            if ch == '\\' {
                if let Some(next) = chars.next() {
                    match next {
                        'n' => result.push('\n'),
                        't' => result.push('\t'),
                        'r' => result.push('\r'),
                        '\\' => result.push('\\'),
                        '"' => result.push('"'),
                        '\'' => result.push('\''),
                        _ => {
                            result.push('\\');
                            result.push(next);
                        }
                    }
                } else {
                    result.push('\\');
                }
            } else {
                result.push(ch);
            }
        }
        
        result
    }
    
    pub fn write_file(path: &Path, vars: &HashMap<String, String>, preserve_original: bool) -> Result<()> {
        let content = if preserve_original && path.exists() {
            // Read original file and update values
            let original = fs::read_to_string(path)?;
            Self::update_content(&original, vars)?
        } else {
            // Create new content
            Self::create_content(vars)
        };
        
        fs::write(path, content)
            .with_context(|| format!("Failed to write file: {}", path.display()))?;
        
        Ok(())
    }
    
    fn update_content(original: &str, vars: &HashMap<String, String>) -> Result<String> {
        let mut result = Vec::new();
        let mut processed_keys = std::collections::HashSet::new();
        
        for line in original.lines() {
            let trimmed = line.trim();
            
            if trimmed.is_empty() || trimmed.starts_with('#') {
                result.push(line.to_string());
                continue;
            }
            
            if let Some(eq_pos) = Self::find_unescaped_equals(trimmed) {
                let key = trimmed[..eq_pos].trim();
                
                if let Some(new_value) = vars.get(key) {
                    result.push(format!("{}={}", key, Self::quote_value(new_value)));
                    processed_keys.insert(key.to_string());
                } else {
                    result.push(line.to_string());
                }
            } else {
                result.push(line.to_string());
            }
        }
        
        // Add any new variables
        for (key, value) in vars {
            if !processed_keys.contains(key) {
                result.push(format!("{}={}", key, Self::quote_value(value)));
            }
        }
        
        Ok(result.join("\n"))
    }
    
    fn create_content(vars: &HashMap<String, String>) -> String {
        let mut lines: Vec<String> = vars
            .iter()
            .map(|(k, v)| format!("{}={}", k, Self::quote_value(v)))
            .collect();
        
        lines.sort();
        lines.join("\n")
    }
    
    fn quote_value(value: &str) -> String {
        // Quote if contains spaces, special chars, or quotes
        if value.contains(' ') || 
           value.contains('\n') || 
           value.contains('\t') || 
           value.contains('"') || 
           value.contains('\'') {
            format!("\"{}\"", value.replace('"', "\\\""))
        } else {
            value.to_string()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    #[test]
    fn test_parse_simple_env() {
        let content = r#"
KEY1=value1
KEY2=value2
# This is a comment
KEY3=value3
"#;
        let vars = EnvFileParser::parse_content(content).unwrap();
        assert_eq!(vars.get("KEY1").unwrap(), "value1");
        assert_eq!(vars.get("KEY2").unwrap(), "value2");
        assert_eq!(vars.get("KEY3").unwrap(), "value3");
        assert_eq!(vars.len(), 3);
    }

    #[test]
    fn test_parse_quoted_values() {
        let content = r#"
SIMPLE=unquoted
DOUBLE="double quoted"
SINGLE='single quoted'
ESCAPED="with \"escaped\" quotes"
"#;
        let vars = EnvFileParser::parse_content(content).unwrap();
        assert_eq!(vars.get("SIMPLE").unwrap(), "unquoted");
        assert_eq!(vars.get("DOUBLE").unwrap(), "double quoted");
        assert_eq!(vars.get("SINGLE").unwrap(), "single quoted");
        assert_eq!(vars.get("ESCAPED").unwrap(), "with \"escaped\" quotes");
    }

    #[test]
    fn test_parse_multiline_values() {
        let content = r#"
SINGLE_LINE=value
WITH_NEWLINE="line1\nline2"
WITH_TAB="value\twith\ttabs"
"#;
        let vars = EnvFileParser::parse_content(content).unwrap();
        assert_eq!(vars.get("SINGLE_LINE").unwrap(), "value");
        assert_eq!(vars.get("WITH_NEWLINE").unwrap(), "line1\nline2");
        assert_eq!(vars.get("WITH_TAB").unwrap(), "value\twith\ttabs");
    }

    #[test]
    fn test_skip_empty_and_comments() {
        let content = r#"
# Comment at start
KEY1=value1

# Another comment
  # Indented comment
KEY2=value2
    
KEY3=value3
"#;
        let vars = EnvFileParser::parse_content(content).unwrap();
        assert_eq!(vars.len(), 3);
    }

    #[test]
    fn test_equals_in_value() {
        let content = r#"
URL=https://example.com?foo=bar&baz=qux
EQUATION=2+2=4
"#;
        let vars = EnvFileParser::parse_content(content).unwrap();
        assert_eq!(vars.get("URL").unwrap(), "https://example.com?foo=bar&baz=qux");
        assert_eq!(vars.get("EQUATION").unwrap(), "2+2=4");
    }
}