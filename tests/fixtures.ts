/**
 * Sample data fixtures — realistic API payloads for Maximo, ServiceNow, and SAP.
 * Used across all test suites.
 */

// ─── Maximo ──────────────────────────────────────────────────────────────────

export const maximoPayload = {
  href: "https://maximo.example.com/maximo/oslc/os/mxwo",
  totalCount: 3,
  member: [
    {
      "href": "https://maximo.example.com/maximo/oslc/os/mxwo/1001",
      "spi:wonum": "WO1001",
      "spi:description": "Fix HVAC unit in Building A",
      "spi:status": "WAPPR",
      "spi:priority": 1,
      "spi:siteid": "BEDFORD",
      "spi:assetnum": "ASSET-001",
      "spi:worktype": "PM",
      "spi:reportdate": "2024-01-15T08:00:00+00:00",
      "spi:targcompdate": "2024-01-20T17:00:00+00:00",
      "spi:location": "BUILDING-A",
      "spi:supervisor": "John Smith",
      "spi:actlabhrs": 4.5,
      "spi:estlabhrs": 6.0
    },
    {
      "href": "https://maximo.example.com/maximo/oslc/os/mxwo/1002",
      "spi:wonum": "WO1002",
      "spi:description": "Replace water pump in Block B",
      "spi:status": "INPRG",
      "spi:priority": 2,
      "spi:siteid": "BEDFORD",
      "spi:assetnum": "ASSET-002",
      "spi:worktype": "CM",
      "spi:reportdate": "2024-01-16T09:00:00+00:00",
      "spi:targcompdate": "2024-01-22T17:00:00+00:00",
      "spi:location": "BUILDING-B",
      "spi:supervisor": "Jane Doe",
      "spi:actlabhrs": 2.0,
      "spi:estlabhrs": 8.0
    },
    {
      "href": "https://maximo.example.com/maximo/oslc/os/mxwo/1003",
      "spi:wonum": "WO1003",
      "spi:description": "Electrical inspection of main switchboard",
      "spi:status": "WAPPR",
      "spi:priority": 1,
      "spi:siteid": "BEDFORD",
      "spi:assetnum": "ASSET-003",
      "spi:worktype": "PM",
      "spi:reportdate": "2024-01-17T07:30:00+00:00",
      "spi:targcompdate": "2024-01-25T17:00:00+00:00",
      "spi:location": "BUILDING-A",
      "spi:supervisor": "John Smith",
      "spi:actlabhrs": 0,
      "spi:estlabhrs": 3.0
    }
  ]
};

// ─── ServiceNow ───────────────────────────────────────────────────────────────

export const serviceNowPayload = {
  result: [
    {
      "sys_id": "abc123def456ghi789",
      "number": "INC0010001",
      "short_description": "User cannot login to VPN",
      "description": "User reports complete inability to authenticate to corporate VPN since morning. Affects remote work.",
      "state": "1",
      "priority": "2",
      "urgency": "2",
      "impact": "2",
      "category": "network",
      "subcategory": "vpn",
      "assigned_to": {
        "link": "https://instance.service-now.com/api/now/table/sys_user/xyz",
        "value": "xyz789"
      },
      "assignment_group": {
        "link": "https://instance.service-now.com/api/now/table/sys_user_group/grp01",
        "value": "grp01"
      },
      "caller_id": {
        "link": "https://instance.service-now.com/api/now/table/sys_user/caller1",
        "value": "USR001"
      },
      "opened_at": "2024-01-15 08:30:00",
      "resolved_at": "",
      "sys_created_on": "2024-01-15 08:30:00",
      "sys_updated_on": "2024-01-15 10:00:00",
      "sys_class_name": "incident",
      "sys_domain": { "link": "https://instance.service-now.com/api/now/table/sys_user_group/global", "value": "global" }
    },
    {
      "sys_id": "def456ghi789jkl012",
      "number": "INC0010002",
      "short_description": "Printer offline on 3rd floor",
      "description": "HP LaserJet in finance department showing offline. Multiple users affected.",
      "state": "2",
      "priority": "3",
      "urgency": "3",
      "impact": "3",
      "category": "hardware",
      "subcategory": "printer",
      "assigned_to": {
        "link": "https://instance.service-now.com/api/now/table/sys_user/abc",
        "value": "abc123"
      },
      "assignment_group": {
        "link": "https://instance.service-now.com/api/now/table/sys_user_group/grp02",
        "value": "grp02"
      },
      "caller_id": {
        "link": "https://instance.service-now.com/api/now/table/sys_user/caller2",
        "value": "USR002"
      },
      "opened_at": "2024-01-16 09:00:00",
      "resolved_at": "",
      "sys_created_on": "2024-01-16 09:00:00",
      "sys_updated_on": "2024-01-16 11:30:00",
      "sys_class_name": "incident",
      "sys_domain": { "link": "https://instance.service-now.com/api/now/table/sys_user_group/global", "value": "global" }
    },
    {
      "sys_id": "ghi789jkl012mno345",
      "number": "INC0010003",
      "short_description": "Email delivery delays across organization",
      "description": "Exchange server showing high queue backlog. Emails delayed by 30-60 minutes.",
      "state": "1",
      "priority": "1",
      "urgency": "1",
      "impact": "1",
      "category": "network",
      "subcategory": "email",
      "assigned_to": {
        "link": "https://instance.service-now.com/api/now/table/sys_user/xyz",
        "value": "xyz789"
      },
      "assignment_group": {
        "link": "https://instance.service-now.com/api/now/table/sys_user_group/grp01",
        "value": "grp01"
      },
      "caller_id": {
        "link": "https://instance.service-now.com/api/now/table/sys_user/caller3",
        "value": "USR003"
      },
      "opened_at": "2024-01-17 07:00:00",
      "resolved_at": "",
      "sys_created_on": "2024-01-17 07:00:00",
      "sys_updated_on": "2024-01-17 07:45:00",
      "sys_class_name": "incident",
      "sys_domain": { "link": "https://instance.service-now.com/api/now/table/sys_user_group/global", "value": "global" }
    }
  ]
};

// ─── SAP OData v2 ─────────────────────────────────────────────────────────────

export const sapPayload = {
  d: {
    results: [
      {
        "__metadata": {
          "id": "https://sap.example.com/sap/opu/odata/sap/API_PURCHASEORDER_PROCESS_SRV/A_PurchaseOrder('4500000001')",
          "type": "API_PURCHASEORDER_PROCESS_SRV.A_PurchaseOrderType",
          "uri": "A_PurchaseOrder('4500000001')"
        },
        "PurchaseOrder": "4500000001",
        "PurchaseOrderType": "NB",
        "Supplier": "VENDOR001",
        "CompanyCode": "1000",
        "PurchasingOrganization": "1000",
        "PurchasingGroup": "001",
        "DocumentCurrency": "USD",
        "ExchangeRate": "1.00000",
        "CreationDate": "/Date(1705276800000)/",
        "PurchaseOrderDate": "/Date(1705276800000)/",
        "TotalNetAmount": "15000.00",
        "PaymentTerms": "NT30",
        "IncotermsLocation1": "New York",
        "to_PurchaseOrderItem": {
          "__deferred": {
            "uri": "A_PurchaseOrder('4500000001')/to_PurchaseOrderItem"
          }
        }
      },
      {
        "__metadata": {
          "id": "https://sap.example.com/sap/opu/odata/sap/API_PURCHASEORDER_PROCESS_SRV/A_PurchaseOrder('4500000002')",
          "type": "API_PURCHASEORDER_PROCESS_SRV.A_PurchaseOrderType",
          "uri": "A_PurchaseOrder('4500000002')"
        },
        "PurchaseOrder": "4500000002",
        "PurchaseOrderType": "NB",
        "Supplier": "VENDOR002",
        "CompanyCode": "1000",
        "PurchasingOrganization": "1000",
        "PurchasingGroup": "002",
        "DocumentCurrency": "EUR",
        "ExchangeRate": "1.08000",
        "CreationDate": "/Date(1705363200000)/",
        "PurchaseOrderDate": "/Date(1705363200000)/",
        "TotalNetAmount": "8500.00",
        "PaymentTerms": "NT30",
        "IncotermsLocation1": "Frankfurt",
        "to_PurchaseOrderItem": {
          "__deferred": {
            "uri": "A_PurchaseOrder('4500000002')/to_PurchaseOrderItem"
          }
        }
      },
      {
        "__metadata": {
          "id": "https://sap.example.com/sap/opu/odata/sap/API_PURCHASEORDER_PROCESS_SRV/A_PurchaseOrder('4500000003')",
          "type": "API_PURCHASEORDER_PROCESS_SRV.A_PurchaseOrderType",
          "uri": "A_PurchaseOrder('4500000003')"
        },
        "PurchaseOrder": "4500000003",
        "PurchaseOrderType": "NB",
        "Supplier": "VENDOR001",
        "CompanyCode": "2000",
        "PurchasingOrganization": "2000",
        "PurchasingGroup": "001",
        "DocumentCurrency": "USD",
        "ExchangeRate": "1.00000",
        "CreationDate": "/Date(1705449600000)/",
        "PurchaseOrderDate": "/Date(1705449600000)/",
        "TotalNetAmount": "32000.00",
        "PaymentTerms": "NT60",
        "IncotermsLocation1": "Chicago",
        "to_PurchaseOrderItem": {
          "__deferred": {
            "uri": "A_PurchaseOrder('4500000003')/to_PurchaseOrderItem"
          }
        }
      }
    ]
  }
};

// ─── SAP OData v4 ─────────────────────────────────────────────────────────────

export const sapV4Payload = {
  "@odata.context": "$metadata#A_SalesOrder",
  "@odata.count": 2,
  "value": [
    {
      "SalesOrder": "0000000100",
      "SalesOrderType": "OR",
      "SoldToParty": "CUST001",
      "SalesOrganization": "1010",
      "DistributionChannel": "10",
      "OrganizationDivision": "00",
      "RequestedDeliveryDate": "2024-02-01",
      "TotalNetAmount": "25000.00",
      "TransactionCurrency": "USD",
      "CreationDate": "2024-01-15",
      "LastChangeDate": "2024-01-16",
      "OverallDeliveryStatus": "A",
      "OverallBillingStatus": "A"
    },
    {
      "SalesOrder": "0000000101",
      "SalesOrderType": "OR",
      "SoldToParty": "CUST002",
      "SalesOrganization": "1010",
      "DistributionChannel": "10",
      "OrganizationDivision": "00",
      "RequestedDeliveryDate": "2024-02-15",
      "TotalNetAmount": "12500.00",
      "TransactionCurrency": "USD",
      "CreationDate": "2024-01-16",
      "LastChangeDate": "2024-01-17",
      "OverallDeliveryStatus": "B",
      "OverallBillingStatus": "A"
    }
  ]
};
