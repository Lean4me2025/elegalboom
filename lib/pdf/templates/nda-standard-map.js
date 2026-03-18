const ndaStandardMap = {
  page: {
    width: 612,
    height: 792
  },

  static: {
    title: {
      text: 'NON-DISCLOSURE AGREEMENT',
      x: 180,
      y: 740,
      size: 16
    }
  },

  fields: {
    effective_date: { x: 50, y: 680, size: 11 },

    disclosing_party_name: { x: 50, y: 650, size: 11 },
    disclosing_party_state: { x: 300, y: 650, size: 11 },

    receiving_party_name: { x: 50, y: 620, size: 11 },
    receiving_party_state: { x: 300, y: 620, size: 11 },

    purpose: { x: 50, y: 580, size: 11 },

    confidentiality_term_years: { x: 50, y: 540, size: 11 },
    governing_state: { x: 300, y: 540, size: 11 },

    disclosing_sign_name: { x: 50, y: 200, size: 11 },
    disclosing_sign_title: { x: 50, y: 180, size: 11 },

    receiving_sign_name: { x: 300, y: 200, size: 11 },
    receiving_sign_title: { x: 300, y: 180, size: 11 }
  }
}

export default ndaStandardMap
