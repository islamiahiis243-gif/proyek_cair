# NPWP Encryption Key Backup, Recovery, and Rotation Runbook

**Document status:** Operator procedure documented; production backup artifact and restore drill are NOT yet verified.  
**Last updated:** 2026-11-14 19:22 WIB  
**Production project:** sjwheagxwpnqckmqxyme  
**Vault secret:** proyek_cair_npwp_master_key  
**Scope:** Application-level key used by private.npwp_derive_key() for NPWP AES-256 encryption and HMAC-SHA256 duplicate fingerprints.

## 1. Critical distinction: two different keys

Proyek Cair depends on two separate key layers:

1. **Supabase project Vault root encryption key.** Supabase manages this outside the database. It encrypts/decrypts Vault storage itself. A database dump does not contain this root key. Supabase's documented Management API /pgsodium endpoint is the supported way to retrieve/copy the 64-character root key for manual project-to-project logical migrations. Treat it as a highest-privilege production credential.
2. **Proyek Cair NPWP application master key.** This is a 32-byte random value stored as the Vault secret named proyek_cair_npwp_master_key. The database functions derive separate encryption and fingerprint keys from it. This value is database content (stored encrypted by Vault), not the Supabase project root key.

Backing up only the database or only the Supabase root key is insufficient for an independent logical migration: the application-level secret must also be preserved securely.

## 2. Access and handling requirements

- Assign a primary and a backup custodian. Restrict access to the Supabase project, Vault decrypted-secret view, and the external secret manager to named operators with production duties.
- Never place either key in GitHub, source code, issue trackers, chat, CI logs, SQL migration files, screenshots, or ordinary backup folders.
- Store the NPWP application master key in an approved external secrets manager or offline encrypted vault with access logging, MFA, and dual-custodian recovery.
- Keep a sealed recovery copy separate from the production database and from the primary operator's workstation.
- Do not copy decrypted Vault values into query output or ticket comments. Retrieve the application master key only through an approved privileged session and transfer it directly into the secret manager.
- Record secret identifier, custody owners, backup timestamp, storage reference, and verification status; never record the secret value.

## 3. Initial backup procedure (required before real NPWP intake)

1. Confirm the Vault secret exists by checking only its metadata (id, name, description, timestamps). Do not select or print decrypted_secret in shared SQL/tool output.
2. Through a privileged operator session, retrieve the decrypted value for proyek_cair_npwp_master_key using the Supabase Vault UI or a tightly controlled secret-export procedure.
3. Transfer the value directly to the approved external secret manager. Store it as a 32-byte hexadecimal secret; do not add whitespace or line breaks.
4. Confirm the stored value has the expected 64 hexadecimal characters without displaying the value. Have the second custodian confirm access to the recovery record.
5. Create a second encrypted offline recovery copy under dual control. Verify the encrypted object can be opened by the designated recovery custodians.
6. Record the custody metadata and date in the organization's restricted operational register. Do not commit backup artifacts to this repository.
7. Mark the gate complete only after the external backup exists and a controlled retrieval check has succeeded.

**Current state (2026-11-14 19:22 WIB):** Vault metadata confirms the named secret exists. No external key backup was created or verified during this implementation. Therefore the backup gate remains OPEN and real NPWP intake at scale must remain blocked.

## 4. Database restore and project migration

### Same-project restore

- Prefer Supabase's supported same-project restore workflow. Supabase documents that same-project pause/restore and point-in-time/in-place restores retain the same project root key.
- After restore, verify the Vault secret metadata exists and run a controlled synthetic NPWP encrypt/decrypt test using the normal private function path. Do not expose plaintext or key values in logs.
- Verify migration history, function privileges, and the proyek_cair_npwp_master_key secret name before reopening registration.

### Restore to a new Supabase project

- Prefer Supabase's supported Restore to a new project flow where possible; current Supabase documentation says it transfers the encryption root key.
- For a manual pg_dump/pg_restore migration, follow Supabase's current backup/restore guide. Retrieve and transfer the source project's 64-character Supabase root key using the official Management API while the source project is active. The target project must receive the matching root key before relying on copied Vault ciphertext. Overwriting a root key incorrectly can make Vault data unrecoverable.
- Separately confirm the application-level Vault secret proyek_cair_npwp_master_key was carried over and is decryptable. If it was not, restore it from the external secret manager into Vault using the expected secret name and description before enabling NPWP-dependent functions.
- Do not perform a manual project migration until both key layers are accounted for and tested. Keep the source project active until verification is complete.

## 5. Application master-key rotation

The application master key is used for **both** NPWP ciphertext and deterministic NPWP fingerprints. Replacing the Vault secret alone would make existing ciphertext unreadable and would cause future fingerprints to differ from historical fingerprints, weakening duplicate detection.

Therefore:

- **Do not rotate by simply calling vault.update_secret() on the live key.**
- Before any NPWP data exists, rotation can be planned as a controlled maintenance change, but still requires a verified old-key backup and a documented rollback.
- Once NPWP data exists, rotation requires a versioned, reviewed migration procedure that:
  1. obtains old and new keys without exposing them to clients;
  2. decrypts and re-encrypts every NPWP ciphertext in both registration requests and companies;
  3. recomputes every HMAC fingerprint using the new fingerprint derivation key;
  4. checks uniqueness across both tables before committing;
  5. updates the Vault secret only within the same controlled transaction/window;
  6. verifies ciphertext round-trips, duplicate detection, and all uniqueness constraints;
  7. retains the old key in restricted escrow until rollback and recovery windows expire, then securely retires it.
- Rotation must be implemented and tested as a dedicated migration before it is executed. No automated key-rotation feature is claimed by this runbook.

## 6. Incident response: suspected compromise or loss

1. Suspend new company registrations and NPWP-dependent writes; do not delete the Vault secret or overwrite the key.
2. Preserve audit evidence and restrict access to the affected Supabase project and secret manager.
3. Determine whether the incident concerns the Supabase project root key, the NPWP application master key, database access, or both.
4. Engage the designated security owner and Supabase support where the platform-managed root key may be involved.
5. If the application key is exposed, prepare a reviewed re-encryption/fingerprint-rotation migration. Do not assume changing the secret revokes access to previously copied ciphertext.
6. If the key is lost, stop NPWP processing and recover from the verified external escrow. If no recoverable copy exists, existing NPWP ciphertext cannot be assumed recoverable.
7. Resume registration only after key custody, encryption/decryption, fingerprint uniqueness, and audit controls have been verified.

## 7. Scheduled controls

- Verify external escrow access at least quarterly and after custodian changes.
- Review Vault secret metadata and privileged access logs monthly.
- Perform a controlled recovery drill at least annually and after major Supabase project migration/restore changes.
- Reassess this procedure whenever Supabase changes Vault/root-key management or the NPWP encryption implementation changes.

## 8. Official references

- Supabase Vault — https://supabase.com/docs/guides/database/vault
- Supabase Backup and Restore using the CLI — https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore
- Supabase Database Backups — https://supabase.com/docs/guides/platform/backups

This runbook documents operator actions; it does not itself create an external backup, prove custody, or complete a recovery drill.
