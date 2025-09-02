export interface LTLShipmentsSummary {
  profitableShipments: {
    count: number;
    total: number;
    average: number;
  };
  lossShipments: {
    count: number;
    total: number;
    average: number;
  };
  totalShipments: {
    count: number;
    overallProfit: number;
  };
  percentageChange: number;
}

export interface ShipmentsSummary {
  profitableShipments: {
    count: number;
    total: number;
    average: number;
  };
  lossShipments: {
    count: number;
    total: number;
    average: number;
  };
  totalShipments: {
    count: number;
    overallProfit: number;
  };
}