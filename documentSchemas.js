// documentSchemas.js
const DOCUMENT_SCHEMAS = {
  "NDA": {
    tier: "Tier 1",
    fields: {
      basic: [
        "client_first_name",
        "client_last_name",
        "client_email",
        "governing_state"
      ],
      parties: [
        "disclosing_party_name",
        "receiving_party_name"
      ],
      options: [
        "nda_term_months"
      ]
    }
  },

  "Operating Agreement": {
    tier: "Tier 2",
    fields: {
      basic: [
        "entity_name",
        "entity_state",
        "effective_date"
      ],
      parties: [
        "member_1_name",
        "member_2_name"
      ],
      options: [
        "ownership_split"
      ]
    }
  },

  "Partnership Agreement": {
    tier: "Tier 3",
    fields: {
      basic: [
        "business_name",
        "governing_state"
      ],
      parties: [
        "partner_1_name",
        "partner_2_name",
        "partner_3_name"
      ],
      options: [
        "profit_split_method"
      ]
    }
  }
};

export default DOCUMENT_SCHEMAS;
