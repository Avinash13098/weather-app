import { Table, Input, Button, Space } from "antd";
import { useState } from "react";

const initialData = [
  { key: 1, name: "John", age: 28 },
  { key: 2, name: "Alice", age: 32 },
];

function UserTable() {
  const [data, setData] = useState(initialData);
  const [searchText, setSearchText] = useState("");

  const filteredData = data.filter((item) =>
    item.name.toLowerCase().includes(searchText.toLowerCase())
  );

  const addRow = () => {
    const newUser = {
      key: Date.now(),
      name: "New User",
      age: 25,
    };
    setData([...data, newUser]);
  };

  const deleteRow = (key) => {
    setData(data.filter((item) => item.key !== key));
  };

  const columns = [
    {
      title: "Name",
      dataIndex: "name",
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
    {
      title: "Age",
      dataIndex: "age",
      sorter: (a, b) => a.age - b.age,
    },
    {
      title: "Action",
      render: (_, record) => (
        <Button danger onClick={() => deleteRow(record.key)}>
          Delete
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: 30 }}>
      <Space style={{ marginBottom: 16 }}>
        <Input
          placeholder="Search by name"
          onChange={(e) => setSearchText(e.target.value)}
        />
        <Button type="primary" onClick={addRow}>
          Add User
        </Button>
      </Space>

      <Table
        columns={columns}
        dataSource={filteredData}
        pagination={{ pageSize: 5 }}
      />
    </div>
  );
}

export default UserTable;
sd