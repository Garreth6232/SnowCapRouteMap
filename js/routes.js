const ROUTES = [
  {
    id: "route-01",
    name: "Route 1",
    color: "#FF5555",
    addresses: [
      "16901 SE Division St, Portland 97236",
      "9850 NE Everett St, Portland 97220",
      "333 SE 127th Ave, Portland 97233",
      "202 SE 188th Ave, Portland 97233",
      "16810 SE Powell Blvd, Portland 97236"
    ],
    coordinates: [
      [45.5034, -122.4873],
      [45.5269, -122.5611],
      [45.5098, -122.529],
      [45.5145, -122.4576],
      [45.4977, -122.4893]
    ]
  },
  {
    id: "route-02",
    name: "Route 2",
    color: "#33A1FD",
    addresses: ["777 NE 8th Ave, Gresham 97030"],
    coordinates: [[45.4996, -122.4314]]
  },
  {
    id: "route-03",
    name: "Route 3",
    color: "#FFD700",
    addresses: [
      "203 SE 162nd Ave, Portland 97233",
      "4405 NE 133rd Ave, Portland 97230",
      "1757 SE 174th Ave, Portland 97233"
    ],
    coordinates: [
      [45.5071, -122.4997],
      [45.553, -122.5265],
      [45.5084, -122.482]
    ]
  },
  {
    id: "route-04",
    name: "Route 4",
    color: "#7CFC00",
    addresses: ["4515 W Powell Blvd, Gresham 97030"],
    coordinates: [[45.4894, -122.4439]]
  },
  {
    id: "route-05",
    name: "Route 5",
    color: "#FF8C00",
    addresses: [
      "724 NE 195th Ave, Portland 97230",
      "16920 SE Powell Blvd, Portland 97236",
      "223 SE 182nd Ave, Portland 97233",
      "15634 SE Division St, Portland 97236",
      "16119 SE Division St, Portland 97236"
    ],
    coordinates: [
      [45.537, -122.474],
      [45.495, -122.4863],
      [45.5142, -122.4711],
      [45.4984, -122.4989],
      [45.4995, -122.493]
    ]
  },
  {
    id: "route-06",
    name: "Route 6",
    color: "#C71585",
    addresses: [
      "16977 NE Halsey St, Portland 97230",
      "660 SE 212th Ave, Gresham 97030",
      "333 NE 181st Ave, Gresham 97030",
      "19625 NE Glisan St, Portland 97230"
    ],
    coordinates: [
      [45.5338, -122.4765],
      [45.5089, -122.4221],
      [45.5271, -122.463],
      [45.5278, -122.4508]
    ]
  },
  {
    id: "route-07",
    name: "Route 7",
    color: "#00CED1",
    addresses: ["777 NE 8th Ave, Gresham 97030"],
    coordinates: [[45.4996, -122.4314]]
  },
  {
    id: "route-08",
    name: "Route 8",
    color: "#FF1493",
    addresses: [
      "930 SE 212th Ave, Gresham 97030",
      "17366 NE Halsey St, Portland 97230",
      "15848 SE Division St, Portland 97236",
      "18737 SE Stark St, Portland 97233"
    ],
    coordinates: [
      [45.5014, -122.4205],
      [45.5345, -122.4928],
      [45.4988, -122.4992],
      [45.5164, -122.4603]
    ]
  },
  {
    id: "route-09",
    name: "Route 9",
    color: "#9370DB",
    addresses: [
      "16745 SE Division St, Portland 97236",
      "100 NE 188th Ave, Portland 97230",
      "128 NE 182nd Ave, Portland 97230"
    ],
    coordinates: [
      [45.4979, -122.4923],
      [45.524, -122.4698],
      [45.5233, -122.4716]
    ]
  },
  {
    id: "route-10",
    name: "Route 10",
    color: "#00FA9A",
    addresses: [
      "2711 W Powell Blvd, Gresham 97030",
      "1999 NE Division St, Gresham 97030",
      "1555 NE Division St, Gresham 97030",
      "1838 E Powell Blvd, Gresham 97030",
      "1505 W Powell Blvd, Gresham 97030"
    ],
    coordinates: [
      [45.4909, -122.4224],
      [45.4998, -122.4142],
      [45.4994, -122.4172],
      [45.4979, -122.4164],
      [45.4996, -122.4191]
    ]
  },
  {
    id: "route-11",
    name: "Route 11",
    color: "#FF4500",
    addresses: [
      "765 Mt Hood Hwy, Gresham 97080",
      "1212 NE Linden Ave, Gresham 97030",
      "1951 NE Cleveland Ave, Gresham 97030",
      "1500 NE Cleveland Ave, Gresham 97030",
      "1001 NE Division St, Gresham 97030"
    ],
    coordinates: [
      [45.489, -122.4391],
      [45.5059, -122.4387],
      [45.5094, -122.4359],
      [45.5048, -122.4352],
      [45.5021, -122.4389]
    ]
  },
  {
    id: "route-12",
    name: "Route 12",
    color: "#1E90FF",
    addresses: [
      "2629 SE 136th Ave, Portland 97236",
      "4751 NE 99th Ave, Portland 97220",
      "2144 SE 139th Ave, Portland 97233",
      "2434 SE 139th Ave, Portland 97233",
      "2602 SE 139th Ave, Portland 97233",
      "2801 SE 139th Ave, Portland 97233"
    ],
    coordinates: [
      [45.4995, -122.5208],
      [45.5535, -122.5564],
      [45.5051, -122.5185],
      [45.5065, -122.5192],
      [45.5078, -122.52],
      [45.5095, -122.5208]
    ]
  },
  {
    id: "route-13",
    name: "Route 13",
    color: "#ADFF2F",
    addresses: [
      "937 NE Hood Ave, Gresham 97030",
      "1280 NE Kane Dr, Gresham 97030",
      "1420 NE Kane Dr, Gresham 97030",
      "1830 NE Kane Dr, Gresham 97030"
    ],
    coordinates: [
      [45.5019, -122.4315],
      [45.506, -122.4284],
      [45.5073, -122.4272],
      [45.5095, -122.4243]
    ]
  }
];

window.ROUTES = ROUTES;
