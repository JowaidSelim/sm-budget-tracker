"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Production = {
  id: string;
  production_name: string;
  stage_manager: string;
  assistant_stage_manager: string | null;
  original_budget: number;
  vat_rate: number;
  allocation_date: string | null;
};

type Purchase = {
  id: string;
  production_id: string;
  receipt: string;
  purchase_date: string;
  category: string;
  item: string;
  payment_method: string;
  supplier: string;
  total_including_vat: number;
};

export default function ReportsPage() {
  const supabase = useMemo(() => createClient(), []);

  const [production, setProduction] =
    useState<Production | null>(null);

  const [purchases, setPurchases] =
    useState<Purchase[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [exporting, setExporting] =
    useState(false);

  const [message, setMessage] =
    useState("");

  useEffect(() => {
    loadReportData();
  }, []);

  async function loadReportData() {
    setLoading(true);
    setMessage("");

    const activeProductionId =
      localStorage.getItem("activeProductionId");

    if (!activeProductionId) {
      setProduction(null);
      setPurchases([]);
      setLoading(false);
      return;
    }

    const {
      data: productionData,
      error: productionError,
    } = await supabase
      .from("productions")
      .select(`
        id,
        production_name,
        stage_manager,
        assistant_stage_manager,
        original_budget,
        vat_rate,
        allocation_date
      `)
      .eq("id", activeProductionId)
      .single();

    if (productionError || !productionData) {
      console.error(productionError);

      setMessage(
        "Could not load the active production."
      );

      setLoading(false);
      return;
    }

    setProduction(
      productionData as Production
    );

    const {
      data: purchaseData,
      error: purchaseError,
    } = await supabase
      .from("purchases")
      .select(`
        id,
        production_id,
        receipt,
        purchase_date,
        category,
        item,
        payment_method,
        supplier,
        total_including_vat
      `)
      .eq(
        "production_id",
        activeProductionId
      )
      .order(
        "purchase_date",
        {
          ascending: true,
        }
      );

    if (purchaseError) {
      console.error(purchaseError);

      setMessage(
        "Could not load purchases."
      );

      setPurchases([]);
      setLoading(false);
      return;
    }

    setPurchases(
      (purchaseData as Purchase[]) ?? []
    );

    setLoading(false);
  }

  function money(value: number) {
    return `AED ${value.toLocaleString(
      "en-AE",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    )}`;
  }

  function normalizePaymentMethod(
    value: string
  ) {
    return value
      .trim()
      .toLowerCase();
  }

  async function handleExcelExport() {
    if (!production) return;

    const currentProduction = production;

    setExporting(true);
    setMessage("");

    try {
      const ExcelJSModule =
        await import("exceljs");

      const ExcelJS =
        ExcelJSModule.default;

      const workbook =
        new ExcelJS.Workbook();

      workbook.creator =
        "SM Budget Tracker";

      workbook.created =
        new Date();

      workbook.calcProperties.fullCalcOnLoad =
        true;

      const vatRate =
        Number(
          currentProduction.vat_rate
        );

      const headerFill =
        "FF0F172A";

      const lightFill =
        "FFF1F5F9";

      const noteFill =
        "FFE2E8F0";

      const propsPurchases =
        purchases.filter(
          (purchase) =>
            purchase.category ===
            "Props"
        );

      const smPurchases =
        purchases.filter(
          (purchase) =>
            purchase.category ===
            "Stage Management"
        );

      const pettyCashPurchases =
        purchases.filter(
          (purchase) =>
            normalizePaymentMethod(
              purchase.payment_method
            ) === "petty cash"
        );

      const creditCardPurchases =
        purchases.filter(
          (purchase) =>
            normalizePaymentMethod(
              purchase.payment_method
            ) === "credit card"
        );

      const poPurchases =
        purchases.filter(
          (purchase) =>
            normalizePaymentMethod(
              purchase.payment_method
            ) === "purchase order"
        );

      function styleSectionHeader(
        worksheet: any,
        cellAddress: string
      ) {
        const cell =
          worksheet.getCell(
            cellAddress
          );

        cell.font = {
          bold: true,
          size: 14,
        };

        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: {
            argb: lightFill,
          },
        };
      }

      function styleTableHeader(
        row: any
      ) {
        row.eachCell(
          (cell: any) => {
            cell.font = {
              bold: true,
              color: {
                argb: "FFFFFFFF",
              },
            };

            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: {
                argb: headerFill,
              },
            };

            cell.alignment = {
              vertical: "middle",
              horizontal: "center",
            };
          }
        );
      }

      function addExportNote(
        worksheet: any
      ) {
        worksheet.mergeCells(
          "A5:H5"
        );

        const noteCell =
          worksheet.getCell(
            "A5"
          );

        noteCell.value =
          "Snapshot export from SM Budget Tracker. Add or edit purchases in the application and re-export for the latest data.";

        noteCell.font = {
          italic: true,
          size: 10,
          color: {
            argb: "FF475569",
          },
        };

        noteCell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: {
            argb: noteFill,
          },
        };

        noteCell.alignment = {
          wrapText: true,
          vertical: "middle",
        };

        worksheet.getRow(
          5
        ).height = 32;
      }

      /*
        Overall sheet first
      */

      const overall =
        workbook.addWorksheet(
          "Overall Budget Tracker"
        );

      /*
        Helper to build the 5 purchase sheets
      */

      function addPurchaseSheet(
        sheetName: string,
        sheetPurchases: Purchase[]
      ) {
        const worksheet =
          workbook.addWorksheet(
            sheetName
          );

        worksheet.mergeCells(
          "A1:H1"
        );

        const titleCell =
          worksheet.getCell(
            "A1"
          );

        titleCell.value =
          sheetName;

        titleCell.font = {
          bold: true,
          size: 18,
          color: {
            argb: "FFFFFFFF",
          },
        };

        titleCell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: {
            argb: headerFill,
          },
        };

        worksheet.getCell(
          "A3"
        ).value =
          "Production";

        worksheet.getCell(
          "B3"
        ).value =
          currentProduction.production_name;

        worksheet.getCell(
          "A4"
        ).value =
          "VAT Rate";

        worksheet.getCell(
          "B4"
        ).value =
          vatRate / 100;

        worksheet.getCell(
          "B4"
        ).numFmt =
          "0.00%";

        addExportNote(
          worksheet
        );

        const headerRow =
          worksheet.getRow(
            7
          );

        headerRow.values = [
          "Receipt / Invoice",
          "Date",
          "Item",
          "Supplier",
          "Payment Method",
          "Total Incl. VAT",
          "Before VAT",
          "VAT",
        ];

        styleTableHeader(
          headerRow
        );

        sheetPurchases.forEach(
          (
            purchase,
            index
          ) => {
            const rowNumber =
              8 + index;

            const row =
              worksheet.getRow(
                rowNumber
              );

            row.getCell(
              1
            ).value =
              purchase.receipt;

            const dateValue =
              new Date(
                `${purchase.purchase_date}T00:00:00`
              );

            row.getCell(
              2
            ).value =
              dateValue;

            row.getCell(
              2
            ).numFmt =
              "dd-mmm-yyyy";

            row.getCell(
              3
            ).value =
              purchase.item;

            row.getCell(
              4
            ).value =
              purchase.supplier;

            row.getCell(
              5
            ).value =
              purchase.payment_method;

            row.getCell(
              6
            ).value =
              Number(
                purchase.total_including_vat
              );

            row.getCell(
              7
            ).value = {
              formula:
                `F${rowNumber}/(1+$B$4)`,
            };

            row.getCell(
              8
            ).value = {
              formula:
                `F${rowNumber}-G${rowNumber}`,
            };

            row.getCell(
              6
            ).numFmt =
              '#,##0.00';

            row.getCell(
              7
            ).numFmt =
              '#,##0.00';

            row.getCell(
              8
            ).numFmt =
              '#,##0.00';
          }
        );

        const firstDataRow =
          8;

        const lastDataRow =
          sheetPurchases.length >
          0
            ? 7 +
              sheetPurchases.length
            : 8;

        const totalRow =
          lastDataRow + 2;

        worksheet.getCell(
          `E${totalRow}`
        ).value =
          "TOTAL";

        if (
          sheetPurchases.length >
          0
        ) {
          worksheet.getCell(
            `F${totalRow}`
          ).value = {
            formula:
              `SUM(F${firstDataRow}:F${lastDataRow})`,
          };

          worksheet.getCell(
            `G${totalRow}`
          ).value = {
            formula:
              `SUM(G${firstDataRow}:G${lastDataRow})`,
          };

          worksheet.getCell(
            `H${totalRow}`
          ).value = {
            formula:
              `SUM(H${firstDataRow}:H${lastDataRow})`,
          };
        } else {
          worksheet.getCell(
            `F${totalRow}`
          ).value =
            0;

          worksheet.getCell(
            `G${totalRow}`
          ).value =
            0;

          worksheet.getCell(
            `H${totalRow}`
          ).value =
            0;
        }

        for (
          let column = 5;
          column <= 8;
          column++
        ) {
          const cell =
            worksheet.getCell(
              totalRow,
              column
            );

          cell.font = {
            bold: true,
          };

          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: {
              argb: lightFill,
            },
          };

          if (
            column >= 6
          ) {
            cell.numFmt =
              '#,##0.00';
          }
        }

        worksheet.columns = [
          {
            width: 20,
          },
          {
            width: 16,
          },
          {
            width: 32,
          },
          {
            width: 24,
          },
          {
            width: 22,
          },
          {
            width: 18,
          },
          {
            width: 18,
          },
          {
            width: 16,
          },
        ];

        worksheet.views = [
          {
            state:
              "frozen",
            ySplit: 7,
          },
        ];

        return totalRow;
      }

      /*
        Build all five purchase views
      */

      const propsTotalRow =
        addPurchaseSheet(
          "Props Expenditure",
          propsPurchases
        );

      const smTotalRow =
        addPurchaseSheet(
          "Stage Management Expenditure",
          smPurchases
        );

      const pettyCashTotalRow =
        addPurchaseSheet(
          "Petty Cash Purchases",
          pettyCashPurchases
        );

      const creditCardTotalRow =
        addPurchaseSheet(
          "Credit Card Purchases",
          creditCardPurchases
        );

      const poTotalRow =
        addPurchaseSheet(
          "Purchase Order Purchases",
          poPurchases
        );

      /*
        Build Overall Budget Tracker
      */

      overall.mergeCells(
        "A1:D1"
      );

      overall.getCell(
        "A1"
      ).value =
        "Overall Budget Tracker";

      overall.getCell(
        "A1"
      ).font = {
        bold: true,
        size: 20,
        color: {
          argb: "FFFFFFFF",
        },
      };

      overall.getCell(
        "A1"
      ).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: {
          argb: headerFill,
        },
      };

      overall.getRow(
        1
      ).height =
        30;

      overall.getCell(
        "A3"
      ).value =
        "Production";

      overall.getCell(
        "B3"
      ).value =
        currentProduction.production_name;

      overall.getCell(
        "A4"
      ).value =
        "Stage Manager";

      overall.getCell(
        "B4"
      ).value =
        currentProduction.stage_manager;

      overall.getCell(
        "A5"
      ).value =
        "Assistant Stage Manager";

      overall.getCell(
        "B5"
      ).value =
        currentProduction.assistant_stage_manager ??
        "";

      overall.getCell(
        "A6"
      ).value =
        "Allocation Date";

      if (
        currentProduction.allocation_date
      ) {
        overall.getCell(
          "B6"
        ).value =
          new Date(
            `${currentProduction.allocation_date}T00:00:00`
          );

        overall.getCell(
          "B6"
        ).numFmt =
          "dd-mmm-yyyy";
      }

      overall.getCell(
        "A7"
      ).value =
        "VAT Rate";

      overall.getCell(
        "B7"
      ).value =
        vatRate / 100;

      overall.getCell(
        "B7"
      ).numFmt =
        "0.00%";

      overall.mergeCells(
        "A8:D8"
      );

      overall.getCell(
        "A8"
      ).value =
        "Snapshot export from SM Budget Tracker. Add or edit purchases in the application and re-export for the latest data.";

      overall.getCell(
        "A8"
      ).font = {
        italic: true,
        size: 10,
        color: {
          argb: "FF475569",
        },
      };

      overall.getCell(
        "A8"
      ).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: {
          argb: noteFill,
        },
      };

      overall.getCell(
        "A8"
      ).alignment = {
        wrapText: true,
      };

      overall.getRow(
        8
      ).height =
        32;

      styleSectionHeader(
        overall,
        "A10"
      );

      overall.getCell(
        "A10"
      ).value =
        "Budget Summary";

      overall.getCell(
        "A12"
      ).value =
        "Original Budget";

      overall.getCell(
        "B12"
      ).value =
        Number(
          currentProduction.original_budget
        );

      overall.getCell(
        "A13"
      ).value =
        "Props Expenditure";

      overall.getCell(
        "B13"
      ).value = {
        formula:
          `'Props Expenditure'!F${propsTotalRow}`,
      };

      overall.getCell(
        "A14"
      ).value =
        "Stage Management Expenditure";

      overall.getCell(
        "B14"
      ).value = {
        formula:
          `'Stage Management Expenditure'!F${smTotalRow}`,
      };

      overall.getCell(
        "A15"
      ).value =
        "Total Expenditure";

      overall.getCell(
        "B15"
      ).value = {
        formula:
          "SUM(B13:B14)",
      };

      overall.getCell(
        "A16"
      ).value =
        "Remaining Budget";

      overall.getCell(
        "B16"
      ).value = {
        formula:
          "B12-B15",
      };

      overall.getCell(
        "A17"
      ).value =
        "Budget Used";

      overall.getCell(
        "B17"
      ).value = {
        formula:
          'IF(B12=0,0,B15/B12)',
      };

      overall.getCell(
        "B17"
      ).numFmt =
        "0.00%";

      overall.getCell(
        "A18"
      ).value =
        "Total VAT";

      overall.getCell(
        "B18"
      ).value = {
        formula:
          `'Props Expenditure'!H${propsTotalRow}+'Stage Management Expenditure'!H${smTotalRow}`,
      };

      styleSectionHeader(
        overall,
        "A21"
      );

      overall.getCell(
        "A21"
      ).value =
        "Payment Method Summary";

      overall.getCell(
        "A23"
      ).value =
        "Petty Cash";

      overall.getCell(
        "B23"
      ).value = {
        formula:
          `'Petty Cash Purchases'!F${pettyCashTotalRow}`,
      };

      overall.getCell(
        "A24"
      ).value =
        "Credit Card";

      overall.getCell(
        "B24"
      ).value = {
        formula:
          `'Credit Card Purchases'!F${creditCardTotalRow}`,
      };

      overall.getCell(
        "A25"
      ).value =
        "Purchase Order";

      overall.getCell(
        "B25"
      ).value = {
        formula:
          `'Purchase Order Purchases'!F${poTotalRow}`,
      };

      overall.getCell(
        "A26"
      ).value =
        "Payment Method Total";

      overall.getCell(
        "B26"
      ).value = {
        formula:
          "SUM(B23:B25)",
      };

      overall.getCell(
        "A28"
      ).value =
        "Reconciliation Difference";

      overall.getCell(
        "B28"
      ).value = {
        formula:
          "B15-B26",
      };

      overall.getCell(
        "A29"
      ).value =
        "Reconciliation Status";

      overall.getCell(
        "B29"
      ).value = {
        formula:
          'IF(ABS(B28)<0.01,"Balanced","Check Entries")',
      };

      [
        12,
        13,
        14,
        15,
        16,
        18,
        23,
        24,
        25,
        26,
        28,
      ].forEach(
        (rowNumber) => {
          overall.getCell(
            `B${rowNumber}`
          ).numFmt =
            '#,##0.00';
        }
      );

      [
        15,
        16,
        26,
        28,
        29,
      ].forEach(
        (rowNumber) => {
          overall.getCell(
            `A${rowNumber}`
          ).font = {
            bold: true,
          };

          overall.getCell(
            `B${rowNumber}`
          ).font = {
            bold: true,
          };

          overall.getCell(
            `A${rowNumber}`
          ).fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: {
              argb: lightFill,
            },
          };

          overall.getCell(
            `B${rowNumber}`
          ).fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: {
              argb: lightFill,
            },
          };
        }
      );

      overall.columns = [
        {
          width: 34,
        },
        {
          width: 24,
        },
        {
          width: 4,
        },
        {
          width: 18,
        },
      ];

      overall.views = [
        {
          state: "frozen",
          ySplit: 1,
        },
      ];

      /*
        Generate Excel file
      */

      const buffer =
        await workbook.xlsx.writeBuffer();

      const blob =
        new Blob(
          [buffer as BlobPart],
          {
            type:
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          }
        );

      const safeName =
        currentProduction.production_name
          .replace(
            /[^a-z0-9]+/gi,
            "-"
          )
          .replace(
            /^-+|-+$/g,
            ""
          );

      const url =
        URL.createObjectURL(
          blob
        );

      const link =
        document.createElement(
          "a"
        );

      link.href =
        url;

      link.download =
        `${
          safeName ||
          "production"
        }-budget.xlsx`;

      document.body.appendChild(
        link
      );

      link.click();

      document.body.removeChild(
        link
      );

      URL.revokeObjectURL(
        url
      );

      setMessage(
        "Excel workbook exported successfully."
      );
    } catch (error) {
      console.error(
        error
      );

      setMessage(
        "Could not create the Excel workbook."
      );
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return (
      <main className="p-6 md:p-10">
        <p className="text-slate-500">
          Loading reports...
        </p>
      </main>
    );
  }

  if (!production) {
    return (
      <main className="p-6 text-slate-900 md:p-10">
        <div className="mx-auto max-w-7xl">

          <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
            <p className="text-lg font-medium">
              No active production
            </p>

            <p className="mt-2 text-slate-500">
              Select a production before creating reports.
            </p>
          </div>

        </div>
      </main>
    );
  }

  const budget =
    Number(
      production.original_budget
    );

  const totalSpent =
    purchases.reduce(
      (sum, purchase) =>
        sum +
        Number(
          purchase.total_including_vat
        ),
      0
    );

  const remaining =
    budget -
    totalSpent;

  const propsTotal =
    purchases
      .filter(
        (purchase) =>
          purchase.category ===
          "Props"
      )
      .reduce(
        (sum, purchase) =>
          sum +
          Number(
            purchase.total_including_vat
          ),
        0
      );

  const stageManagementTotal =
    purchases
      .filter(
        (purchase) =>
          purchase.category ===
          "Stage Management"
      )
      .reduce(
        (sum, purchase) =>
          sum +
          Number(
            purchase.total_including_vat
          ),
        0
      );

  return (
    <main className="min-h-screen p-6 text-slate-900 md:p-10">
      <div className="mx-auto max-w-7xl">

        <div className="mb-8">
          <h1 className="text-3xl font-bold">
            Reports
          </h1>

          <p className="mt-2 text-slate-500">
            {
              production.production_name
            }
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500">
              Budget
            </p>

            <p className="mt-2 text-2xl font-bold">
              {money(
                budget
              )}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500">
              Total Spent
            </p>

            <p className="mt-2 text-2xl font-bold">
              {money(
                totalSpent
              )}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500">
              Remaining
            </p>

            <p className="mt-2 text-2xl font-bold">
              {money(
                remaining
              )}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500">
              Purchases
            </p>

            <p className="mt-2 text-2xl font-bold">
              {
                purchases.length
              }
            </p>
          </div>

        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">

          <div className="rounded-2xl bg-white p-6 shadow-sm">

            <h2 className="text-lg font-semibold">
              Expenditure Summary
            </h2>

            <div className="mt-6 space-y-4">

              <div className="flex justify-between">
                <span className="text-slate-500">
                  Props
                </span>

                <span className="font-semibold">
                  {money(
                    propsTotal
                  )}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-slate-500">
                  Stage Management
                </span>

                <span className="font-semibold">
                  {money(
                    stageManagementTotal
                  )}
                </span>
              </div>

              <div className="border-t border-slate-200 pt-4">

                <div className="flex justify-between">
                  <span className="font-medium">
                    Total
                  </span>

                  <span className="font-bold">
                    {money(
                      totalSpent
                    )}
                  </span>
                </div>

              </div>

            </div>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">

            <h2 className="text-lg font-semibold">
              Export
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Export the active production as a connected Excel workbook.
            </p>

            <div className="mt-6 rounded-xl bg-slate-100 p-4">

              <p className="text-sm font-medium">
                Six-Sheet Excel Workbook
              </p>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                Includes Overall Budget Tracker, Props Expenditure,
                Stage Management Expenditure, Petty Cash Purchases,
                Credit Card Purchases and Purchase Order Purchases.
              </p>

            </div>

            <button
              type="button"
              onClick={
                handleExcelExport
              }
              disabled={
                exporting
              }
              className="mt-6 w-full rounded-xl bg-slate-900 px-5 py-3 font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {exporting
                ? "Creating Excel..."
                : "Export Excel Workbook"}
            </button>

            {message && (
              <p className="mt-4 text-sm text-slate-600">
                {message}
              </p>
            )}

          </div>

        </div>

      </div>
    </main>
  );
}