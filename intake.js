<script type="module">
  import DOCUMENT_SCHEMAS from './documentSchemas.js';

  const selectedDoc = sessionStorage.getItem("doc_type");

  if (!selectedDoc || !DOCUMENT_SCHEMAS[selectedDoc]) {
    alert("Missing or invalid document type.");
  }

  const schema = DOCUMENT_SCHEMAS[selectedDoc];

  renderIntake(schema);

  function renderIntake(schema) {
    renderBasicFields(schema.fields.basic);
    renderPartyFields(schema.fields.parties);
    renderOptionFields(schema.fields.options);
  }
</script>
