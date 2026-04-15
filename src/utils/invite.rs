use rand::{distributions::Alphanumeric, Rng};

/// Generates a random 10-character uppercase alphanumeric invite code.
/// Example output: "A3BX7KCQM2"
pub fn generate_invite_code() -> String {
    rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(10)
        .map(|c| char::from(c.to_ascii_uppercase()))
        .collect()
}
