import React, { useState, useEffect } from 'react';
import { printQueue } from './PrintQueueManager';
import PrintableReceipt from '../../features/pos/components/PrintableReceipt';
import { SystemPrinterAdapter } from './Adapters';

export default function PrintSpooler() {
  const [activeJob, setActiveJob] = useState(null);

  useEffect(() => {
    const handleJob = (job) => {
      setActiveJob(job);
    };

    const unsubscribe = printQueue.subscribe(handleJob);
    return () => unsubscribe();
  }, []);

  if (!activeJob || !activeJob.receiptData) return null;

  // We only need to render PrintableReceipt if it's a 'system' printer,
  // but it's safe to render it for any print job (it just stays hidden via CSS).
  // We use SystemPrinterAdapter's helper to convert the new ReceiptData format to the legacy order format.
  const legacyOrder = new SystemPrinterAdapter()._convertToLegacyOrder(activeJob.receiptData);

  return (
    <div style={{ position: 'absolute', top: -9999, left: -9999 }}>
      <PrintableReceipt order={legacyOrder} />
    </div>
  );
}
