UPDATE `store_settings`
SET `business_name` = 'ATE ANNA''S STORE POS',
    `updated_at` = CURRENT_TIMESTAMP
WHERE `id` = 1
  AND `business_name` = 'SWIRL-DRY AND SARI-SARI STORE';
