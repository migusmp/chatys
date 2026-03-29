pub mod conversations;
pub mod db;
pub mod messages;
pub mod undelivered_messages;

pub mod offset_date_time_serde {
    use serde::{self, Deserialize, Deserializer, Serializer};
    use sqlx::types::time::OffsetDateTime;
    use time::format_description::well_known::Rfc3339;

    pub fn serialize<S>(date: &Option<OffsetDateTime>, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        match date {
            Some(dt) => {
                let s = dt.format(&Rfc3339).map_err(serde::ser::Error::custom)?;
                serializer.serialize_str(&s)
            }
            None => serializer.serialize_none(),
        }
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<Option<OffsetDateTime>, D::Error>
    where
        D: Deserializer<'de>,
    {
        let opt = Option::<String>::deserialize(deserializer)?;
        match opt {
            Some(s) => OffsetDateTime::parse(&s, &Rfc3339)
                .map(Some)
                .map_err(serde::de::Error::custom),
            None => Ok(None),
        }
    }
}
