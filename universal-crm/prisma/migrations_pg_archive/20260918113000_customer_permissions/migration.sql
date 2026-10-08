-- Migration: 20260918113000_customer_permissions
-- Additive migration to sync customer module permissions for existing system roles

-- Admin roles: add customers.manage
INSERT INTO "permissions" ("id", "roleId", "module", "action", "dataScope", "createdAt")
SELECT 
    concat('perm_cust_adm_', md5(random()::text || clock_timestamp()::text)),
    r.id,
    'customers',
    'manage',
    'COMPANY'::"DataScope",
    CURRENT_TIMESTAMP
FROM "roles" r
WHERE r.name = 'Admin'
AND NOT EXISTS (
    SELECT 1 FROM "permissions" p 
    WHERE p."roleId" = r.id 
    AND p."module" = 'customers' 
    AND p."action" = 'manage'
);

-- Manager roles: add customers.view, customers.create, customers.update, customers.manage
INSERT INTO "permissions" ("id", "roleId", "module", "action", "dataScope", "createdAt")
SELECT 
    concat('perm_cust_mgr_', act, '_', md5(random()::text || clock_timestamp()::text)),
    r.id,
    'customers',
    act,
    'COMPANY'::"DataScope",
    CURRENT_TIMESTAMP
FROM "roles" r
CROSS JOIN (VALUES ('view'), ('create'), ('update'), ('manage')) AS actions(act)
WHERE r.name = 'Manager'
AND NOT EXISTS (
    SELECT 1 FROM "permissions" p 
    WHERE p."roleId" = r.id 
    AND p."module" = 'customers' 
    AND p."action" = act
);

-- Sales Rep roles: add customers.view, customers.create, customers.update
INSERT INTO "permissions" ("id", "roleId", "module", "action", "dataScope", "createdAt")
SELECT 
    concat('perm_cust_rep_', act, '_', md5(random()::text || clock_timestamp()::text)),
    r.id,
    'customers',
    act,
    'COMPANY'::"DataScope",
    CURRENT_TIMESTAMP
FROM "roles" r
CROSS JOIN (VALUES ('view'), ('create'), ('update')) AS actions(act)
WHERE r.name = 'Sales Rep'
AND NOT EXISTS (
    SELECT 1 FROM "permissions" p 
    WHERE p."roleId" = r.id 
    AND p."module" = 'customers' 
    AND p."action" = act
);

-- Viewer roles: add customers.view
INSERT INTO "permissions" ("id", "roleId", "module", "action", "dataScope", "createdAt")
SELECT 
    concat('perm_cust_viw_', md5(random()::text || clock_timestamp()::text)),
    r.id,
    'customers',
    'view',
    'COMPANY'::"DataScope",
    CURRENT_TIMESTAMP
FROM "roles" r
WHERE r.name = 'Viewer'
AND NOT EXISTS (
    SELECT 1 FROM "permissions" p 
    WHERE p."roleId" = r.id 
    AND p."module" = 'customers' 
    AND p."action" = 'view'
);

-- Support roles: add customers.view, customers.update
INSERT INTO "permissions" ("id", "roleId", "module", "action", "dataScope", "createdAt")
SELECT 
    concat('perm_cust_sup_', act, '_', md5(random()::text || clock_timestamp()::text)),
    r.id,
    'customers',
    act,
    'COMPANY'::"DataScope",
    CURRENT_TIMESTAMP
FROM "roles" r
CROSS JOIN (VALUES ('view'), ('update')) AS actions(act)
WHERE r.name = 'Support'
AND NOT EXISTS (
    SELECT 1 FROM "permissions" p 
    WHERE p."roleId" = r.id 
    AND p."module" = 'customers' 
    AND p."action" = act
);
