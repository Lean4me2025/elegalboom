
export const ndaStandardMap = {
  page: {
    width: 612,
    height: 792
  },

  fonts: {
    regular: 'Helvetica',
    bold: 'HelveticaBold'
  },

  static: {
    title: {
      text: 'NON-DISCLOSURE AGREEMENT',
      x: 306,
      y: 730,
      size: 16,
      align: 'center',
      font: 'bold'
    }
  },

  fields: {
    effective_date: { x: 165, y: 675, size: 11, maxWidth: 140 },
    disclosing_party_name: { x: 145, y: 642, size: 11, maxWidth: 180 },
    disclosing_party_state: { x: 430, y: 642, size: 11, maxWidth: 90 },

    receiving_party_name: { x: 140, y: 609, size: 11, maxWidth: 180 },
    receiving_party_state: { x: 420, y: 609, size: 11, maxWidth: 100 },

    purpose: {
      x: 105,
      y: 560,
      size: 11,
      maxWidth: 435,
      multiline: true,
      lineHeight: 14
    },

    confidentiality_term_years: { x: 312, y: 417, size: 11, maxWidth: 40 },
    governing_state: { x: 185, y: 417, size: 11, maxWidth: 110 },

    disclosing_sign_name: { x: 85, y: 180, size: 11, maxWidth: 180 },
    disclosing_sign_title: { x: 85, y: 145, size: 11, maxWidth: 180 },

    receiving_sign_name: { x: 340, y: 180, size: 11, maxWidth: 180 },
    receiving_sign_title: { x: 340, y: 145, size: 11, maxWidth: 180 }
  }
};
