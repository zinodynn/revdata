import { FolderOutlined } from '@ant-design/icons'
import { message, Modal, Tree, Typography } from 'antd'
import type { DataNode, TreeProps } from 'antd/es/tree'
import { useEffect, useState } from 'react'
import { datasetsApi, foldersApi } from '../services/api'

interface FolderNode {
  id: number
  name: string
  parent_id: number | null
  children: FolderNode[]
  dataset_count: number
}

interface MoveFolderModalProps {
  open: boolean
  datasetId: number | null
  datasetName?: string
  onClose: () => void
  onSuccess: () => void
}

export default function MoveFolderModal({
  open,
  datasetId,
  datasetName,
  onClose,
  onSuccess,
}: MoveFolderModalProps) {
  const [loading, setLoading] = useState(false)
  const [folders, setFolders] = useState<FolderNode[]>([])
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null)
  const [loadingFolders, setLoadingFolders] = useState(false)

  // 加载目录树
  const loadFolders = async () => {
    setLoadingFolders(true)
    try {
      const res = await foldersApi.list()
      setFolders(res.data)
    } catch (error) {
      message.error('加载目录失败')
    } finally {
      setLoadingFolders(false)
    }
  }

  useEffect(() => {
    if (open) {
      loadFolders()
      setSelectedFolderId(null)
    }
  }, [open])

  // 转换为 Ant Design Tree 数据格式
  const convertToTreeData = (nodes: FolderNode[]): DataNode[] => {
    return nodes.map((node) => ({
      key: node.id,
      title: node.name,
      icon: <FolderOutlined />,
      children: node.children.length > 0 ? convertToTreeData(node.children) : undefined,
    }))
  }

  const treeData: DataNode[] = [
    {
      key: 'root',
      title: '根目录',
      icon: <FolderOutlined />,
      children: convertToTreeData(folders),
    },
  ]

  const handleSelect: TreeProps['onSelect'] = (selectedKeys) => {
    if (selectedKeys.length > 0) {
      const key = selectedKeys[0]
      if (key === 'root') {
        setSelectedFolderId(null)
      } else {
        setSelectedFolderId(key as number)
      }
    }
  }

  const handleSubmit = async () => {
    if (datasetId === null) return

    setLoading(true)
    try {
      await datasetsApi.move(datasetId, selectedFolderId)
      message.success('数据集移动成功')
      onSuccess()
      onClose()
    } catch (error: any) {
      if (error.response?.data?.detail) {
        message.error(error.response.data.detail)
      } else {
        message.error('移动数据集失败')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      title={`移动数据集: ${datasetName}`}
      open={open}
      onOk={handleSubmit}
      onCancel={onClose}
      confirmLoading={loading}
      okText="移动"
      cancelText="取消"
      width={400}
    >
      <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
        选择目标目录:
      </Typography.Paragraph>
      <div
        style={{
          border: '1px solid #d9d9d9',
          borderRadius: 8,
          padding: 8,
          maxHeight: 300,
          overflow: 'auto',
        }}
      >
        {loadingFolders ? (
          <div style={{ textAlign: 'center', padding: 20 }}>加载中...</div>
        ) : (
          <Tree
            showIcon
            defaultExpandAll
            selectedKeys={selectedFolderId === null ? ['root'] : [selectedFolderId]}
            onSelect={handleSelect}
            treeData={treeData}
          />
        )}
      </div>
    </Modal>
  )
}
