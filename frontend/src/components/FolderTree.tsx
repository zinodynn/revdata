import { FolderOpenOutlined, FolderOutlined, PlusOutlined } from '@ant-design/icons'
import { Button, Dropdown, Empty, message, Spin, Tree } from 'antd'
import type { DataNode, TreeProps } from 'antd/es/tree'
import { useEffect, useState } from 'react'
import { foldersApi } from '../services/api'

interface FolderNode {
  id: number
  name: string
  parent_id: number | null
  children: FolderNode[]
  dataset_count: number
}

interface FolderTreeProps {
  selectedFolderId: number | null
  onSelect: (folderId: number | null) => void
  onCreateFolder: (parentId: number | null) => void
  onRenameFolder: (folder: { id: number; name: string }) => void
  onDeleteFolder: (folderId: number) => void
  refreshTrigger?: number
}

export default function FolderTree({
  selectedFolderId,
  onSelect,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  refreshTrigger,
}: FolderTreeProps) {
  const [loading, setLoading] = useState(false)
  const [folders, setFolders] = useState<FolderNode[]>([])
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([])

  // 加载目录树
  const loadFolders = async () => {
    setLoading(true)
    try {
      const res = await foldersApi.list()
      setFolders(res.data)
    } catch (error) {
      message.error('加载目录失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadFolders()
  }, [refreshTrigger])

  // 转换为 Ant Design Tree 数据格式
  const convertToTreeData = (nodes: FolderNode[]): DataNode[] => {
    return nodes.map((node) => ({
      key: node.id,
      title: (
        <Dropdown
          menu={{
            items: [
              {
                key: 'create',
                label: '新建子目录',
                onClick: () => onCreateFolder(node.id),
              },
              {
                key: 'rename',
                label: '重命名',
                onClick: () => onRenameFolder({ id: node.id, name: node.name }),
              },
              { type: 'divider' },
              {
                key: 'delete',
                label: '删除',
                danger: true,
                onClick: () => onDeleteFolder(node.id),
              },
            ],
          }}
          trigger={['contextMenu']}
        >
          <span>
            {node.name}
            {node.dataset_count > 0 && (
              <span style={{ color: '#999', marginLeft: 4 }}>({node.dataset_count})</span>
            )}
          </span>
        </Dropdown>
      ),
      icon: ({ expanded }: { expanded?: boolean }) =>
        expanded ? <FolderOpenOutlined /> : <FolderOutlined />,
      children: node.children.length > 0 ? convertToTreeData(node.children) : undefined,
    }))
  }

  const treeData: DataNode[] = [
    {
      key: 'root',
      title: (
        <Dropdown
          menu={{
            items: [
              {
                key: 'create',
                label: '新建目录',
                onClick: () => onCreateFolder(null),
              },
            ],
          }}
          trigger={['contextMenu']}
        >
          <span style={{ fontWeight: 500 }}>全部数据集</span>
        </Dropdown>
      ),
      icon: <FolderOutlined />,
      children: convertToTreeData(folders),
    },
  ]

  const handleSelect: TreeProps['onSelect'] = (selectedKeys) => {
    if (selectedKeys.length > 0) {
      const key = selectedKeys[0]
      if (key === 'root') {
        onSelect(null)
      } else {
        onSelect(key as number)
      }
    }
  }

  const handleExpand: TreeProps['onExpand'] = (keys) => {
    setExpandedKeys(keys)
  }

  if (loading && folders.length === 0) {
    return (
      <div style={{ padding: 16, textAlign: 'center' }}>
        <Spin size="small" />
      </div>
    )
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
          padding: '0 8px',
        }}
      >
        <span style={{ fontWeight: 500 }}>目录</span>
        <Button
          type="text"
          size="small"
          icon={<PlusOutlined />}
          onClick={() => onCreateFolder(null)}
        />
      </div>
      {folders.length === 0 ? (
        <div style={{ padding: '8px 16px' }}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="暂无目录"
            style={{ margin: 0 }}
          />
          <div
            style={{
              marginTop: 8,
              padding: '8px 0',
              cursor: 'pointer',
              color: selectedFolderId === null ? '#1890ff' : undefined,
            }}
            onClick={() => onSelect(null)}
          >
            <FolderOutlined style={{ marginRight: 8 }} />
            全部数据集
          </div>
        </div>
      ) : (
        <Tree
          showIcon
          defaultExpandAll
          selectedKeys={selectedFolderId === null ? ['root'] : [selectedFolderId]}
          expandedKeys={expandedKeys.length > 0 ? expandedKeys : ['root']}
          onSelect={handleSelect}
          onExpand={handleExpand}
          treeData={treeData}
          style={{ background: 'transparent' }}
        />
      )}
    </div>
  )
}
