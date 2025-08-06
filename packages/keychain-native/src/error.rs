use std::fmt;

#[derive(Debug)]
pub enum KeychainError {
    NotFound(String),
    AccessDenied,
    InvalidData(String),
    InvalidParameter(String),
    PlatformError(String),
    Unsupported(String),
    UnsupportedPlatform,
}

impl fmt::Display for KeychainError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            KeychainError::NotFound(account) => write!(f, "Keychain item not found: {}", account),
            KeychainError::AccessDenied => write!(f, "Access denied to keychain"),
            KeychainError::InvalidData(msg) => write!(f, "Invalid data: {}", msg),
            KeychainError::InvalidParameter(msg) => write!(f, "Invalid parameter: {}", msg),
            KeychainError::PlatformError(msg) => write!(f, "Platform error: {}", msg),
            KeychainError::Unsupported(msg) => write!(f, "Unsupported operation: {}", msg),
            KeychainError::UnsupportedPlatform => write!(f, "This operation is not supported on this platform"),
        }
    }
}

impl std::error::Error for KeychainError {}

impl From<KeychainError> for napi::Error {
    fn from(err: KeychainError) -> Self {
        napi::Error::new(napi::Status::GenericFailure, err.to_string())
    }
}

pub type Result<T> = std::result::Result<T, KeychainError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_keychain_error_display() {
        let error = KeychainError::NotFound("test_account".to_string());
        assert_eq!(error.to_string(), "Keychain item not found: test_account");

        let error = KeychainError::AccessDenied;
        assert_eq!(error.to_string(), "Access denied to keychain");

        let error = KeychainError::InvalidData("bad format".to_string());
        assert_eq!(error.to_string(), "Invalid data: bad format");
    }

    #[test]
    fn test_keychain_error_conversion() {
        let error = KeychainError::NotFound("test".to_string());
        let napi_error: napi::Error = error.into();
        assert_eq!(napi_error.status, napi::Status::GenericFailure);
    }

    #[test]
    fn test_platform_error() {
        let error = KeychainError::PlatformError("macOS specific error".to_string());
        assert_eq!(error.to_string(), "Platform error: macOS specific error");
    }

    #[test]
    fn test_unsupported_platform() {
        let error = KeychainError::UnsupportedPlatform;
        assert_eq!(error.to_string(), "This operation is not supported on this platform");
    }
}